import { expect, test } from "bun:test";
import { callDaemonTool, MCP_TIMEOUT_MS, type McpPost } from "./mcp-client";

const TOKEN = "a".repeat(64);
const ENV = { KIBO_MCP_URL: "http://127.0.0.1:9/agent-mcp/r1", KIBO_RUN_TOKEN: TOKEN };

type Seen = { url: string; init: RequestInit };

const answering = (response: () => Response) => {
  const seen: Seen[] = [];
  const post: McpPost = async (url, init) => {
    seen.push({ url, init });
    return response();
  };
  return { seen, post };
};

test("posts the tool and its input with the run token and relays the text", async () => {
  const { seen, post } = answering(() => Response.json({ ok: true, text: '{"items":[]}' }));
  const reply = await callDaemonTool(ENV, "list_tickets", { status: "done" }, post);
  expect(reply).toEqual({ text: '{"items":[]}', isError: false });
  expect(seen).toHaveLength(1);
  const [call] = seen;
  expect(call?.url).toBe(ENV.KIBO_MCP_URL);
  expect(call?.init.method).toBe("POST");
  expect(call?.init.headers).toMatchObject({
    authorization: `Bearer ${TOKEN}`,
    "content-type": "application/json",
  });
  expect(JSON.parse(String(call?.init.body))).toEqual({ tool: "list_tickets", input: { status: "done" } });
  expect(call?.init.signal).toBeInstanceOf(AbortSignal);
});

test("a domain error becomes an error result with its code", async () => {
  const { post } = answering(() =>
    Response.json({ ok: false, error: { code: "NOT_FOUND", message: "ticket AUTRE-1" } }),
  );
  expect(await callDaemonTool(ENV, "get_ticket", { key: "AUTRE-1" }, post)).toEqual({
    text: "NOT_FOUND: ticket AUTRE-1",
    isError: true,
  });
});

test("a failed or unreadable answer is reported, never thrown", async () => {
  const failed = answering(() => new Response("boom", { status: 500 }));
  expect(await callDaemonTool(ENV, "list_runs", {}, failed.post)).toEqual({
    text: "Kibo a répondu 500.",
    isError: true,
  });
  const garbled = answering(() => new Response("<html>", { status: 200 }));
  expect(await callDaemonTool(ENV, "list_runs", {}, garbled.post)).toEqual({
    text: "Kibo a répondu 200 sans réponse lisible.",
    isError: true,
  });
  const odd = answering(() => Response.json({ ok: "yes" }));
  expect((await callDaemonTool(ENV, "list_runs", {}, odd.post)).isError).toBe(true);
});

test("an unreachable daemon is an error result that never leaks the token", async () => {
  const down: McpPost = async () => {
    throw new Error("ECONNREFUSED");
  };
  const reply = await callDaemonTool(ENV, "project_overview", {}, down);
  expect(reply.isError).toBe(true);
  expect(reply.text).toStartWith("Kibo injoignable");
  expect(reply.text).not.toContain(TOKEN);
});

test("gives up after five seconds", async () => {
  expect(MCP_TIMEOUT_MS).toBe(5_000);
  const hanging: McpPost = (_url, init) =>
    new Promise((_resolve, reject) =>
      init.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
    );
  const reply = await callDaemonTool(ENV, "list_notes", {}, hanging, 20);
  expect(reply.isError).toBe(true);
  expect(reply.text).toStartWith("Kibo injoignable");
});

test("without its URL or its token, it answers an error without calling", async () => {
  const { seen, post } = answering(() => Response.json({ ok: true, text: "x" }));
  for (const env of [{ KIBO_RUN_TOKEN: TOKEN }, { KIBO_MCP_URL: ENV.KIBO_MCP_URL }, {}]) {
    expect(await callDaemonTool(env, "list_tickets", {}, post)).toMatchObject({ isError: true });
  }
  expect(seen).toHaveLength(0);
});
