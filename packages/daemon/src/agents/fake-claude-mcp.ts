import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

export type McpServer = { command: string; args: string[]; env: Record<string, string> };
export type McpCallLog = { tool: string; text: string; isError: boolean };

export const MCP_CALL_TIMEOUT_MS = 10_000;
const EXIT_GRACE_MS = 300;
const BASE_ENV_KEYS = ["PATH", "HOME", "TMPDIR", "USER", "LOGNAME", "SHELL", "TERM", "LANG"];

const McpConfig = z.object({
  mcpServers: z.record(
    z.string(),
    z.object({
      command: z.string().min(1),
      args: z.array(z.string()).default([]),
      env: z.record(z.string(), z.string()).default({}),
    }),
  ),
});

const RpcResponse = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.number(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).optional(),
});
type RpcResponse = z.infer<typeof RpcResponse>;

const ToolResult = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  isError: z.boolean().optional(),
});

export function mcpServerFrom(argv: readonly string[]): McpServer {
  const i = argv.indexOf("--mcp-config");
  const raw = i >= 0 ? argv[i + 1] : undefined;
  if (raw === undefined) throw new Error("no --mcp-config");
  const json = raw.trim().startsWith("{") ? raw : readFileSync(raw, "utf8");
  const kibo = McpConfig.parse(JSON.parse(json)).mcpServers.kibo;
  if (!kibo) throw new Error("no kibo server in --mcp-config");
  return kibo;
}

const baseEnv = (): Record<string, string> =>
  Object.fromEntries(
    BASE_ENV_KEYS.flatMap((key) => {
      const value = process.env[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );

type Waiter = { resolve: (reply: RpcResponse) => void; reject: (error: Error) => void };

function dispatch(line: string, waiters: Map<number, Waiter>): void {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    process.stderr.write(`fake-claude: MCP server printed a non JSON line\n`);
    return;
  }
  const reply = RpcResponse.safeParse(json);
  if (!reply.success) return;
  waiters.get(reply.data.id)?.resolve(reply.data);
  waiters.delete(reply.data.id);
}

async function readReplies(stdout: ReadableStream<Uint8Array>, waiters: Map<number, Waiter>) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stdout) {
    buffer += decoder.decode(chunk, { stream: true });
    for (let i = buffer.indexOf("\n"); i >= 0; i = buffer.indexOf("\n")) {
      dispatch(buffer.slice(0, i), waiters);
      buffer = buffer.slice(i + 1);
    }
  }
  for (const waiter of waiters.values()) waiter.reject(new Error("fake-claude: MCP server exited"));
  waiters.clear();
}

type ToolReply = { text: string; isError: boolean };

const failure = (text: string): ToolReply => ({ text, isError: true });

const resultOf = (reply: RpcResponse): ToolReply => {
  if (reply.error) return failure(reply.error.message);
  const result = ToolResult.safeParse(reply.result);
  if (!result.success) return failure("fake-claude: invalid tools/call result");
  const text = result.data.content.flatMap((c) => (c.text === undefined ? [] : [c.text])).join("\n");
  return { text, isError: result.data.isError === true };
};

export async function callMcpTool(
  server: McpServer,
  tool: string,
  input: unknown,
  timeoutMs: number = MCP_CALL_TIMEOUT_MS,
): Promise<ToolReply> {
  const proc = Bun.spawn([server.command, ...server.args], {
    env: { ...baseEnv(), ...server.env },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
  });
  const waiters = new Map<number, Waiter>();
  const reading = readReplies(proc.stdout, waiters);
  const send = (message: Record<string, unknown>) =>
    proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  const request = (id: number, method: string, params: unknown) =>
    new Promise<RpcResponse>((resolve, reject) => {
      waiters.set(id, { resolve, reject });
      send({ id, method, params });
    });
  const session = async () => {
    const init = await request(1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "fake-claude", version: "1.0.0" },
    });
    if (init.error) return failure(init.error.message);
    send({ method: "notifications/initialized" });
    return resultOf(await request(2, "tools/call", { name: tool, arguments: input }));
  };
  let timer: Timer | undefined;
  const timeout = new Promise<ToolReply>((resolve) => {
    timer = setTimeout(() => resolve(failure("fake-claude: MCP server timed out")), timeoutMs);
  });
  try {
    return await Promise.race([session(), timeout]);
  } catch (e) {
    return failure(e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
    proc.stdin.end();
    await Promise.race([proc.exited, Bun.sleep(EXIT_GRACE_MS)]);
    proc.kill();
    await Promise.all([proc.exited, reading]);
  }
}

export function recordMcpCalls(callsFile: string, calls: readonly McpCallLog[]): void {
  if (calls.length === 0) return;
  const lines = readFileSync(callsFile, "utf8").trim().split("\n");
  const last = z.record(z.string(), z.unknown()).parse(JSON.parse(lines.pop() ?? "{}"));
  writeFileSync(callsFile, `${[...lines, JSON.stringify({ ...last, mcp: calls })].join("\n")}\n`);
}

const PROFILE_REF = /^\{\{profile:(.+)\}\}$/;
const ListedProfiles = z.array(z.object({ id: z.string(), name: z.string() }));

function profileId(name: string, calls: readonly McpCallLog[]): string {
  const listed = [...calls].reverse().find((c) => c.tool === "list_profiles" && !c.isError);
  if (!listed) throw new Error(`no list_profiles reply to resolve profile ${name}`);
  const profile = ListedProfiles.parse(JSON.parse(listed.text)).find((p) => p.name === name);
  if (!profile) throw new Error(`no profile named ${name}`);
  return profile.id;
}

function bindValue(value: unknown, calls: readonly McpCallLog[]): unknown {
  if (typeof value === "string") {
    const name = PROFILE_REF.exec(value)?.[1];
    return name === undefined ? value : profileId(name, calls);
  }
  if (Array.isArray(value)) return value.map((v) => bindValue(v, calls));
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, bindValue(v, calls)]));
  return value;
}

export function bindProfiles(
  input: Record<string, unknown>,
  calls: readonly McpCallLog[],
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, bindValue(v, calls)]));
}
