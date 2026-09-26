import { KiboError } from "@kibo/schema";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export type StdioOptions = { id: string; cmd: string[]; env: Record<string, string>; cwd: string };
const MAX_STDERR_LINE = 500;
export const KILL_GRACE_MS = 2_000;
export const MAX_MESSAGE_BYTES = 8 * 1_048_576;

const spawnServer = (o: StdioOptions) =>
  Bun.spawn(o.cmd, {
    env: o.env,
    cwd: o.cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

async function relayStderr(id: string, stream: ReadableStream<Uint8Array>): Promise<void> {
  const decoder = new TextDecoder();
  let pending = "";
  for await (const chunk of stream) {
    const lines = (pending + decoder.decode(chunk, { stream: true })).split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) if (line) console.error(`[kibo-mcp ${id}] ${line.slice(0, MAX_STDERR_LINE)}`);
  }
}

const isGone = (e: unknown) =>
  e instanceof Error && "code" in e && (e.code === "ESRCH" || e.code === "EPERM");

function killGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (e) {
    // macOS answers EPERM, not ESRCH, for a group whose members are all zombies
    if (!isGone(e)) throw e;
  }
}

async function terminate(proc: ReturnType<typeof spawnServer>): Promise<void> {
  killGroup(proc.pid, "SIGTERM");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const grace = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, KILL_GRACE_MS);
  });
  await Promise.race([proc.exited.then(() => undefined), grace]);
  clearTimeout(timer);
  killGroup(proc.pid, "SIGKILL");
  await proc.exited;
}

export class BunStdioTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;
  private proc: ReturnType<typeof spawnServer> | null = null;
  private readonly buffer = new ReadBuffer({ maxBufferSize: MAX_MESSAGE_BYTES });

  constructor(private readonly options: StdioOptions) {}

  async start(): Promise<void> {
    const proc = spawnServer(this.options);
    this.proc = proc;
    this.pump(proc.stdout).catch((e) => this.onerror?.(asError(e)));
    relayStderr(this.options.id, proc.stderr).catch((e) => this.onerror?.(asError(e)));
    proc.exited.then(() => this.exited(proc)).catch((e) => this.onerror?.(asError(e)));
  }

  private exited(proc: ReturnType<typeof spawnServer>): void {
    if (this.proc === proc) {
      this.proc = null;
      killGroup(proc.pid, "SIGKILL");
    }
    this.onclose?.();
  }

  private async pump(stream: ReadableStream<Uint8Array>): Promise<void> {
    for await (const chunk of stream) {
      try {
        this.buffer.append(Buffer.from(chunk));
      } catch (e) {
        this.onerror?.(asError(e));
        await this.close();
        return;
      }
      this.drain();
    }
  }

  private drain(): void {
    for (;;) {
      let message: JSONRPCMessage | null;
      try {
        message = this.buffer.readMessage();
      } catch (e) {
        this.onerror?.(asError(e));
        continue;
      }
      if (message === null) return;
      this.onmessage?.(message);
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.proc) throw new KiboError("MCP_UNAVAILABLE", "stdio transport not started");
    this.proc.stdin.write(serializeMessage(message));
    await this.proc.stdin.flush();
  }

  async close(): Promise<void> {
    const proc = this.proc;
    this.proc = null;
    if (proc) await terminate(proc);
  }
}
