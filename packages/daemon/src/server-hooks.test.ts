import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HookSink } from "./agents/hook-route";
import type { AgentMcpSink } from "./project-agent/types";
import { startServer } from "./server";
import { createService } from "./service";
import { openStore, type Store } from "./store";

let home: string;
let store: Store;
let server: ReturnType<typeof startServer>;
const TOKEN = "a".repeat(64);

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-srv-"));
  store = openStore(home);
  server = startServer({
    service: createService(store, { user: "adam" }),
    token: TOKEN,
    port: 0,
    uiDir: null,
  });
});
afterEach(() => {
  server.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
});

describe("agents routes", () => {
  const RUN = crypto.randomUUID();
  const hookTo = (url: string, runId: string, headers: Record<string, string>) =>
    fetch(`${url}/hooks/${runId}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({
        payload: {
          event: "Stop",
          sessionId: "s",
          transcriptPath: null,
          tool: null,
          detail: null,
          question: null,
          agentId: null,
        },
        toolInput: null,
      }),
    });

  test("hook posts skip the session but need the run token and a local Host", async () => {
    expect((await hookTo(server.url, RUN, {})).status).toBe(404);
    const foreign = await hookTo(server.url, RUN, {
      authorization: `Bearer ${"b".repeat(64)}`,
      host: "evil.test",
    });
    expect(foreign.status).toBe(403);
  });

  test("hook posts reach the sink only with the right run token", async () => {
    const received: string[] = [];
    const sink: HookSink = {
      verify: (runId, token) => runId === RUN && token === "b".repeat(64),
      receive: (runId, payload) => {
        received.push(`${runId}:${payload.event}`);
        return null;
      },
    };
    const hooked = startServer({
      service: createService(store, { user: "adam" }),
      token: TOKEN,
      port: 0,
      uiDir: null,
      hooks: sink,
    });
    const bearer = { authorization: `Bearer ${"b".repeat(64)}` };
    const wrong = await hookTo(hooked.url, RUN, { authorization: `Bearer ${"0".repeat(64)}` });
    const foreign = await hookTo(hooked.url, RUN, { ...bearer, host: "evil.test" });
    const ok = await hookTo(hooked.url, RUN, bearer);
    const notUuid = await hookTo(hooked.url, "not-a-run", bearer);
    hooked.stop();
    expect(wrong.status).toBe(401);
    expect(foreign.status).toBe(403);
    expect(ok.status).toBe(204);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(notUuid.status).toBe(404);
    expect(received).toEqual([`${RUN}:Stop`]);
  });

  test("agent-mcp posts skip the session but need the run token and a local Host", async () => {
    const bearer = { authorization: `Bearer ${"b".repeat(64)}` };
    const toolTo = (url: string, headers: Record<string, string>) =>
      fetch(`${url}/agent-mcp/${RUN}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ tool: "list_tickets", input: {} }),
      });
    expect((await toolTo(server.url, bearer)).status).toBe(404);
    const sink: AgentMcpSink = {
      verify: (runId, token) => runId === RUN && token === "b".repeat(64),
      call: async (runId, req) => `${req.tool}:${runId}`,
    };
    const served = startServer({
      service: createService(store, { user: "adam" }),
      token: TOKEN,
      port: 0,
      uiDir: null,
      agentMcp: sink,
    });
    const anonymous = await toolTo(served.url, {});
    const foreign = await toolTo(served.url, { ...bearer, host: "evil.test" });
    const ok = await toolTo(served.url, bearer);
    served.stop();
    expect(anonymous.status).toBe(401);
    expect(foreign.status).toBe(403);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(await ok.json()).toEqual({ ok: true, text: `list_tickets:${RUN}` });
  });
});
