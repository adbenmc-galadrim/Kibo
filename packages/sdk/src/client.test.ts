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
