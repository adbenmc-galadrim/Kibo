import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentMcpSink } from "./project-agent/types";
import { runView } from "./questions/questions.test-helper";
import type { HookSink } from "./runs/hook-route";
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

  test("a stop reply of the sink reaches Claude Code as a block", async () => {
    const sink: HookSink = {
      verify: (runId, token) => runId === RUN && token === "b".repeat(64),
      receive: () => ({ kind: "stop", reason: "compte rendu" }),
    };
    const hooked = startServer({
      service: createService(store, { user: "adam" }),
      token: TOKEN,
      port: 0,
      uiDir: null,
      hooks: sink,
    });
    const res = await hookTo(hooked.url, RUN, { authorization: `Bearer ${"b".repeat(64)}` });
    hooked.stop();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ decision: "block", reason: "compte rendu" });
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
      run: (runId) => runView({ id: runId, kind: "project", ticketId: null }),
      call: async (run, tool) => `${tool}:${run.id}`,
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

describe("question images", () => {
  const Q = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
  const IMG = "0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d";
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

  test("an image of a question needs a session, then is served on the main port", async () => {
    const served = startServer({
      service: createService(store, { user: "adam" }),
      token: TOKEN,
      port: 0,
      uiDir: null,
      questionImages: { read: (q, i) => (q === Q && i === IMG ? { bytes: PNG, mime: "image/png" } : null) },
    });
    const paired = await fetch(`${served.url}/api/pair`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: served.url },
      body: JSON.stringify({ token: TOKEN }),
    });
    const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
    const image = (id: string, headers: Record<string, string> = {}) =>
      fetch(`${served.url}/api/questions/${Q}/images/${id}`, { headers });
    const anonymous = await image(IMG);
    const ok = await image(IMG, { cookie });
    const unknown = await image("00000000-0000-4000-8000-000000000000", { cookie });
    served.stop();
    expect(anonymous.status).toBe(401);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(PNG);
    expect(unknown.status).toBe(404);
  });

  test("without an image store, a paired browser gets 404", async () => {
    const paired = await fetch(`${server.url}/api/pair`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: server.url },
      body: JSON.stringify({ token: TOKEN }),
    });
    const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
    const res = await fetch(`${server.url}/api/questions/${Q}/images/${IMG}`, { headers: { cookie } });
    expect(res.status).toBe(404);
  });
});
