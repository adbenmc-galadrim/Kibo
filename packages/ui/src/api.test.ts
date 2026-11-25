import { expect, test } from "bun:test";
import { createClient, type KiboClient } from "@kibo/sdk";
import { PROJECTS } from "./settings/phone-fixtures";

const realApi = "./api?real";

const recordingClient = (methods: string[]): KiboClient => {
  const respond = async (_input: string | URL | Request, init?: RequestInit) => {
    const body: unknown = JSON.parse(String(init?.body));
    if (typeof body === "object" && body !== null && "method" in body) methods.push(String(body.method));
    return Response.json({ ok: true, result: PROJECTS });
  };
  return createClient({
    baseUrl: "http://127.0.0.1:1",
    fetch: Object.assign(respond, { preconnect: fetch.preconnect }),
  });
};

test("installClient swaps the implementation used by client.rpc", async () => {
  const { client, installClient, onWrite }: typeof import("./api") = await import(realApi);
  const methods: string[] = [];
  const subscribed: string[] = [];
  const impl = recordingClient(methods);
  installClient({ ...impl, online: () => true, subscribe: () => () => subscribed.push("released") });
  expect(await client.rpc({ method: "listProjects" })).toEqual(PROJECTS);
  expect(client.online()).toBe(true);
  client.subscribe(() => undefined)();
  expect(subscribed).toEqual(["released"]);
  const written: (string | null)[] = [];
  const off = onWrite((projectId) => written.push(projectId));
  await client.rpc({ method: "sendProjectAgentMessage", projectId: "silo", text: "Où en est le sprint ?" });
  off();
  expect(methods).toEqual(["listProjects", "sendProjectAgentMessage"]);
  expect(written).toEqual(["silo"]);
});
