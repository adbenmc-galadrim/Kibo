import { z } from "zod";

export type McpPost = (url: string, init: RequestInit) => Promise<Response>;
export type McpToolReply = { text: string; isError: boolean };
export type McpEnv = { KIBO_MCP_URL?: string; KIBO_RUN_TOKEN?: string };

export const MCP_TIMEOUT_MS = 5_000;

const DaemonReply = z.union([
  z.object({ ok: z.literal(true), text: z.string() }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);

const failure = (text: string): McpToolReply => ({ text, isError: true });

async function readReply(res: Response): Promise<McpToolReply> {
  if (!res.ok) return failure(`Kibo a répondu ${res.status}.`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return failure(`Kibo a répondu ${res.status} sans réponse lisible.`);
  }
  const reply = DaemonReply.safeParse(json);
  if (!reply.success) return failure(`Kibo a répondu ${res.status} sans réponse lisible.`);
  return reply.data.ok
    ? { text: reply.data.text, isError: false }
    : failure(`${reply.data.error.code}: ${reply.data.error.message}`);
}

export async function callDaemonTool(
  env: McpEnv,
  tool: string,
  input: unknown,
  post: McpPost = fetch,
  timeoutMs: number = MCP_TIMEOUT_MS,
): Promise<McpToolReply> {
  const url = env.KIBO_MCP_URL;
  const token = env.KIBO_RUN_TOKEN;
  if (!url || !token) return failure("Kibo injoignable : KIBO_MCP_URL et KIBO_RUN_TOKEN manquent.");
  let res: Response;
  try {
    res = await post(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ tool, input }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    return failure(`Kibo injoignable : ${e instanceof Error ? e.name : "error"}.`);
  }
  return readReply(res);
}
