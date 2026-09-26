import { chmodSync, closeSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { isCompiled, type OsSandbox, osSandbox, type SandboxPolicy } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";
import { signalGroup } from "../process-group";
import {
  type BackendHost,
  type Channel,
  type ChannelHandlers,
  createHost,
  type HostOptions,
} from "./host-core";
import { BACKEND_MESSAGE_LIMIT, readLines } from "./line-channel";

const LOG_LIMIT = 65_536;
const DEV_ROOT = resolve(import.meta.dir, "../../../..");

export type ProcessHostOptions = HostOptions & {
  command?: string[];
  sandbox?: OsSandbox;
  allowUnsandboxed?: () => boolean;
};

export function runtimePolicy(command: string[], cwd: string): SandboxPolicy {
  return { read: isCompiled() ? [] : [DEV_ROOT], write: [cwd], exec: command.slice(0, 1), cwd };
}

export function runtimeCommand(): string[] {
  return isCompiled()
    ? [process.execPath, "component-runtime"]
    : [process.execPath, join(import.meta.dir, "..", "component-runtime.ts")];
}

async function pipeLog(stream: ReadableStream<Uint8Array>, log: (line: string) => void): Promise<void> {
  let seen = 0;
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    if (seen >= LOG_LIMIT) continue;
    const part = chunk.subarray(0, LOG_LIMIT - seen);
    seen += part.byteLength;
    log(decoder.decode(part));
  }
}

function closeQuietly(fd: number, log: (line: string) => void): void {
  try {
    closeSync(fd);
  } catch (e) {
    log(`cannot close descriptor ${fd}: ${String(e)}`);
  }
}

function parseLine(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function killGroup(pid: number, log: (line: string) => void): void {
  try {
    signalGroup(pid, "SIGKILL");
  } catch (e) {
    log(`cannot kill process group ${pid}: ${String(e)}`);
  }
}

function workDir(): { cwd: string; remove(log: (line: string) => void): void } {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "kibo-backend-")));
  chmodSync(cwd, 0o700);
  return {
    cwd,
    remove(log) {
      try {
        rmSync(cwd, { recursive: true, force: true });
      } catch (e) {
        log(`cannot remove ${cwd}: ${String(e)}`);
      }
    },
  };
}

async function isolation(
  sandbox: OsSandbox,
  allowed: () => boolean,
  log: (line: string) => void,
): Promise<boolean> {
  try {
    await sandbox.ready();
    return true;
  } catch (e) {
    if (!(e instanceof KiboError) || e.code !== "SANDBOX_UNAVAILABLE" || !allowed()) throw e;
    log(`starting without OS isolation (allowed by the user): ${e.detail}`);
    return false;
  }
}

function spawnRuntime(
  opts: ProcessHostOptions,
  sandbox: OsSandbox,
  isolated: boolean,
  handlers: ChannelHandlers,
  log: (line: string) => void,
) {
  const dir = workDir();
  try {
    const command = opts.command ?? runtimeCommand();
    const argv = isolated ? sandbox.wrap(command, runtimePolicy(command, dir.cwd)) : command;
    return Bun.spawn(argv, {
      cwd: dir.cwd,
      env: { KIBO_COMPONENT: opts.ref },
      stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"],
      detached: true,
      onExit: (_p, code, signal) => {
        dir.remove(log);
        handlers.exit(`code ${code ?? "none"}, signal ${signal ?? "none"}`);
      },
    });
  } catch (e) {
    dir.remove(log);
    throw new KiboError("COMPONENT_CRASHED", `cannot start the runtime: ${String(e)}`);
  }
}

export function createProcessHost(opts: ProcessHostOptions): BackendHost {
  const log = opts.log ?? ((line: string) => console.error(`[kibo-daemon] ${opts.ref}: ${line}`));
  const sandbox = opts.sandbox ?? osSandbox();
  let isolated = true;
  const open = async (handlers: ChannelHandlers): Promise<Channel> => {
    const proc = spawnRuntime(opts, sandbox, isolated, handlers, log);
    const close = () => killGroup(proc.pid, log);
    pipeLog(proc.stderr, log).catch((e: unknown) => log(`stderr closed: ${String(e)}`));
    const input = proc.stdio[3];
    const output = proc.stdio[4];
    if (typeof input !== "number" || typeof output !== "number") {
      close();
      throw new KiboError("COMPONENT_CRASHED", "the runtime pipes are missing");
    }
    const reading = readLines(Bun.file(output).stream(), BACKEND_MESSAGE_LIMIT, {
      line: (text) => {
        const parsed = parseLine(text);
        if (parsed.ok) handlers.message(parsed.value);
        else handlers.exit("invalid JSON from the runtime");
      },
      overflow: () => handlers.exit(`message larger than ${BACKEND_MESSAGE_LIMIT} bytes`),
    }).catch((e: unknown) => log(`runtime output closed: ${String(e)}`));
    Promise.all([proc.exited, reading]).then(() => {
      closeQuietly(input, log);
      closeQuietly(output, log);
    });
    const sink = Bun.file(input).writer();
    const write = (m: unknown) => {
      sink.write(`${JSON.stringify(m)}\n`);
      sink.flush();
    };
    write(opts.code);
    return { send: write, close };
  };
  const beforeStart = async () => {
    isolated = await isolation(sandbox, opts.allowUnsandboxed ?? (() => false), log);
    await opts.beforeStart?.();
  };
  return createHost({ ...opts, log, beforeStart }, open, false);
}
