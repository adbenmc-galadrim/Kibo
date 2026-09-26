import { chmodSync, closeSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isCompiled } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";
import { signalGroup } from "../process-group";
import {
  type BackendHost,
  type Channel,
  type ChannelHandlers,
  createHost,
  type HostOptions,
} from "./host-core";

const LOG_LIMIT = 65_536;

export type ProcessHostOptions = HostOptions & { command?: string[] };

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

async function writeCode(fd: number, payload: string): Promise<void> {
  try {
    const sink = Bun.file(fd).writer();
    sink.write(payload);
    await sink.end();
  } finally {
    closeSync(fd);
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
  const cwd = mkdtempSync(join(tmpdir(), "kibo-backend-"));
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

function spawnRuntime(opts: ProcessHostOptions, handlers: ChannelHandlers, log: (line: string) => void) {
  const dir = workDir();
  try {
    return Bun.spawn(opts.command ?? runtimeCommand(), {
      cwd: dir.cwd,
      env: { KIBO_COMPONENT: opts.ref },
      stdio: ["ignore", "ignore", "pipe", "pipe"],
      detached: true,
      serialization: "json",
      ipc: (message) => handlers.message(message),
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
  const open = async (handlers: ChannelHandlers): Promise<Channel> => {
    const proc = spawnRuntime(opts, handlers, log);
    const close = () => killGroup(proc.pid, log);
    pipeLog(proc.stderr, log).catch((e: unknown) => log(`stderr closed: ${String(e)}`));
    const fd = proc.stdio[3];
    try {
      if (typeof fd !== "number") throw new Error("descriptor 3 is not a pipe");
      await writeCode(fd, JSON.stringify(opts.code));
    } catch (e) {
      close();
      throw new KiboError("COMPONENT_CRASHED", `cannot send the code to the runtime: ${String(e)}`);
    }
    return { send: (m) => proc.send(m), close };
  };
  return createHost({ ...opts, log }, open, false);
}
