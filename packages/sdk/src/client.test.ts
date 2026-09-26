import { expect, test } from "bun:test";
import { createClient } from "./client";

const stubFetch = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test("rpc returns the result or throws a typed error", async () => {
  const ok = createClient({ baseUrl: "http://127.0.0.1:1", fetch: stubFetch(200, { ok: true, result: [] }) });
  expect(await ok.rpc({ method: "listProjects" })).toEqual([]);
  const ko = createClient({
    baseUrl: "http://127.0.0.1:1",
    fetch: stubFetch(404, { ok: false, error: { code: "NOT_FOUND", message: "x" } }),
  });
  await expect(ko.rpc({ method: "getProject", projectId: "p" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  const anon = createClient({ baseUrl: "http://127.0.0.1:1", fetch: stubFetch(401, {}) });
  await expect(anon.rpc({ method: "listProjects" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

test("a 401 on rpc notifies onUnauthorized before throwing", async () => {
  const events: string[] = [];
  const client = createClient({
    baseUrl: "http://127.0.0.1:1",
    fetch: stubFetch(401, {}),
    onUnauthorized: () => events.push("unauthorized"),
  });
  await client.rpc({ method: "listProjects" }).catch((e: unknown) => events.push(String(e)));
  expect(events).toEqual(["unauthorized", "KiboError: UNAUTHORIZED: pairing required"]);
  const other = createClient({
    baseUrl: "http://127.0.0.1:1",
    fetch: stubFetch(404, { ok: false, error: { code: "NOT_FOUND", message: "x" } }),
    onUnauthorized: () => events.push("unexpected"),
  });
  await expect(other.rpc({ method: "listProjects" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(events).toHaveLength(2);
});

test("topic, run and project messages reach their own listeners", async () => {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (req, srv) => (srv.upgrade(req) ? undefined : new Response("upgrade required", { status: 400 })),
    websocket: {
      open(ws) {
        ws.send(JSON.stringify({ projectId: "p1" }));
        ws.send(JSON.stringify({ topic: "agents" }));
        ws.send(JSON.stringify({ type: "run.changed", runId: "r1", state: "running" }));
      },
      message() {},
    },
  });
  const client = createClient({ baseUrl: `http://127.0.0.1:${server.port}` });
  const seen: string[] = [];
  const done = Promise.withResolvers<void>();
  const offProject = client.subscribe((id) => seen.push(`project:${id}`));
  const offAgents = client.subscribeTopic("agents", () => seen.push("agents"));
  const offConfig = client.subscribeTopic("config", () => seen.push("config"));
  const offRuns = client.onRunChanged((e) => {
    seen.push(`run:${e.runId}:${e.state}`);
    done.resolve();
  });
  await done.promise;
  expect(seen).toEqual(["project:p1", "agents", "run:r1:running"]);
  offProject();
  offAgents();
  offConfig();
  offRuns();
  server.stop(true);
});

test("the connection status follows the event socket", async () => {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (req, srv) => (srv.upgrade(req) ? undefined : new Response("upgrade required", { status: 400 })),
    websocket: { message() {} },
  });
  const client = createClient({ baseUrl: `http://127.0.0.1:${server.port}` });
  const seen: boolean[] = [];
  const opened = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>();
  const offStatus = client.onConnection(() => {
    seen.push(client.online());
    (client.online() ? opened : closed).resolve();
  });
  expect(client.online()).toBe(false);
  const offAgents = client.subscribeTopic("agents", () => {});
  await opened.promise;
  server.stop(true);
  await closed.promise;
  expect(seen).toEqual([true, false]);
  offAgents();
  offStatus();
});
