import { KiboError } from "@kibo/schema";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { signalGroup } from "../process-group";

export type StdioOptions = { id: string; cmd: string[]; env: Record<string, string>; cwd: string };
const MAX_STDERR_LINE = 500;
export const KILL_GRACE_MS = 2_000;

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

async function terminate(proc: ReturnType<typeof spawnServer>): Promise<void> {
  signalGroup(proc.pid, "SIGTERM");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const grace = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, KILL_GRACE_MS);
  });
  await Promise.race([proc.exited.then(() => undefined), grace]);
  clearTimeout(timer);
  signalGroup(proc.pid, "SIGKILL");
  await proc.exited;
}

export class BunStdioTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;
  private proc: ReturnType<typeof spawnServer> | null = null;
  private readonly buffer = new ReadBuffer();

  constructor(private readonly options: StdioOptions) {}

  async start(): Promise<void> {
    const proc = spawnServer(this.options);
    this.proc = proc;
    this.pump(proc.stdout).catch((e) => this.onerror?.(asError(e)));
    relayStderr(this.options.id, proc.stderr).catch((e) => this.onerror?.(asError(e)));
    proc.exited.then(
      () => this.onclose?.(),
      (e) => this.onerror?.(asError(e)),
    );
  }

  private async pump(stream: ReadableStream<Uint8Array>): Promise<void> {
    for await (const chunk of stream) {
      this.buffer.append(Buffer.from(chunk));
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
