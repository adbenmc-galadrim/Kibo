import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { QUESTION_OPTIONS_MAX, TOOL_SPECS } from "@kibo/schema";
import { z } from "zod";
import { callDaemonTool, type McpToolReply } from "./mcp-client";

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

export const ASK_QUESTION_REPLY =
  "Question enregistrée dans Kibo, ouverte. Continue avec ton choix provisoire ; la réponse te sera transmise.";

const ASK_PROPERTIES = {
  question: { type: "string", description: "La question, claire et autonome." },
  context: { type: "string", description: "Le contexte utile pour répondre, en Markdown." },
  options: {
    type: "array",
    items: { type: "string" },
    maxItems: QUESTION_OPTIONS_MAX,
    description: "Les réponses possibles, s'il y en a.",
  },
  provisional: { type: "string", description: "Ton choix provisoire, parmi les options s'il y en a." },
};

const ASK_TOOL_SPECS = [
  {
    name: "ask_user",
    reply: ASK_REPLY,
    description:
      "Pose une question à l'utilisateur de Kibo, puis termine ton tour. Kibo te relance avec sa réponse.",
    inputSchema: { type: "object", properties: ASK_PROPERTIES, required: ["question"] },
  },
  {
    name: "ask_question",
    reply: ASK_QUESTION_REPLY,
    description:
      "Enregistre dans Kibo une décision que tu prends provisoirement, puis continue avec ton choix provisoire. La réponse te sera transmise.",
    inputSchema: { type: "object", properties: ASK_PROPERTIES, required: ["question", "provisional"] },
  },
];

export type McpTools = { project: boolean };
export type DaemonCall = (tool: string, input: unknown) => Promise<McpToolReply>;

const PROJECT_TOOL_SPECS = TOOL_SPECS.map(({ name, description, inputSchema }) => ({
  name,
  description,
  inputSchema,
}));

const listedTools = (tools: McpTools) => [
  ...ASK_TOOL_SPECS.map(({ reply: _reply, ...spec }) => spec),
  ...(tools.project ? PROJECT_TOOL_SPECS : []),
];

const argumentsOf = (params: Record<string, unknown> | undefined): unknown => params?.arguments ?? {};

function parse(line: string): { ok: true; json: unknown } | { ok: false } {
  try {
    return { ok: true, json: JSON.parse(line) };
  } catch {
    return { ok: false };
  }
}

export async function handleMcpLine(
  line: string,
  tools: McpTools,
  call: DaemonCall,
): Promise<McpReply | null> {
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
      return ok({ tools: listedTools(tools) });
    case "tools/call": {
      const name = params?.name;
      const ask = ASK_TOOL_SPECS.find((t) => t.name === name);
      if (ask) return ok({ content: [{ type: "text", text: ask.reply }] });
      if (!tools.project || !PROJECT_TOOL_SPECS.some((t) => t.name === name))
        return fail(-32602, `unknown tool ${String(name)}`);
      const reply = await call(String(name), argumentsOf(params));
      return ok({ content: [{ type: "text", text: reply.text }], isError: reply.isError });
    }
    default:
      return fail(-32601, `method ${method} not found`);
  }
}

export async function serveMcp(
  input: Readable,
  output: Writable,
  env: Record<string, string | undefined>,
): Promise<void> {
  const tools: McpTools = { project: Boolean(env.KIBO_MCP_URL) };
  const call: DaemonCall = (tool, args) => callDaemonTool(env, tool, args);
  const pending: Promise<void>[] = [];
  for await (const line of createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY })) {
    if (!line.trim()) continue;
    pending.push(
      handleMcpLine(line, tools, call).then((reply) => {
        if (reply) output.write(`${JSON.stringify(reply)}\n`);
      }),
    );
  }
  await Promise.all(pending);
}
