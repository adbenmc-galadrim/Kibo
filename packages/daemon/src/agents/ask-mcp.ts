import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { z } from "zod";

const McpMessage = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type McpReply = {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
};

export const ASK_REPLY =
  "Question transmise à l'utilisateur par Kibo. Termine ton tour maintenant, sans autre action : Kibo te relancera avec sa réponse.";

const ASK_TOOL_SPEC = {
  name: "ask_user",
  description:
    "Pose une question à l'utilisateur de Kibo, puis termine ton tour. Kibo te relance avec sa réponse.",
  inputSchema: {
    type: "object",
    properties: { question: { type: "string", description: "La question, claire et autonome." } },
    required: ["question"],
  },
};

function parse(line: string): { ok: true; json: unknown } | { ok: false } {
  try {
    return { ok: true, json: JSON.parse(line) };
  } catch {
    return { ok: false };
  }
}

export function handleMcpLine(line: string): McpReply | null {
  const read = parse(line);
  if (!read.ok) return { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } };
  const parsed = McpMessage.safeParse(read.json);
  if (!parsed.success)
    return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid request" } };
  const { id, method, params } = parsed.data;
  if (id === undefined) return null;
  const ok = (result: unknown): McpReply => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string): McpReply => ({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
  switch (method) {
    case "initialize": {
      const version = typeof params?.protocolVersion === "string" ? params.protocolVersion : "2025-06-18";
      return ok({
        protocolVersion: version,
        capabilities: { tools: {} },
        serverInfo: { name: "kibo", version: "0.2.0" },
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: [ASK_TOOL_SPEC] });
    case "tools/call":
      return params?.name === ASK_TOOL_SPEC.name
        ? ok({ content: [{ type: "text", text: ASK_REPLY }] })
        : fail(-32602, `unknown tool ${String(params?.name)}`);
    default:
      return fail(-32601, `method ${method} not found`);
  }
}

export async function serveMcp(input: Readable, output: Writable): Promise<void> {
  for await (const line of createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY })) {
    if (!line.trim()) continue;
    const reply = handleMcpLine(line);
    if (reply) output.write(`${JSON.stringify(reply)}\n`);
  }
}
