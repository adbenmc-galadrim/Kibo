import { expect, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { dispatchRpc, type RpcHandler, requireLocal } from "./rpc-extensions";
import type { Service } from "./service";

const ctx = { sessionHash: "h", remote: false };
const service = { handle: async (req: RpcRequest) => `service:${req.method}` } as unknown as Service;

test("an extension wins for its declared methods", async () => {
  const ext = { methods: ["listSessions"] as const, handle: async () => "ext" };
  expect(await dispatchRpc(service, [ext], { method: "listSessions" }, ctx)).toBe("ext");
});

test("handlers are tried in order before the service", async () => {
  const seen: string[] = [];
  const skip: RpcHandler = async () => {
    seen.push("skip");
    return { handled: false };
  };
  const take: RpcHandler = async () => {
    seen.push("take");
    return { handled: true, result: 42 };
  };
  expect(await dispatchRpc(service, [], { method: "listProjects" }, ctx, [skip, take])).toBe(42);
  expect(seen).toEqual(["skip", "take"]);
});

test("the service answers when nothing handles the request", async () => {
  expect(await dispatchRpc(service, [], { method: "listProjects" }, ctx, [])).toBe("service:listProjects");
});

test("requireLocal refuses a remote session", () => {
  expect(() => requireLocal({ sessionHash: "h", remote: true })).toThrow("FORBIDDEN");
  expect(() => requireLocal(ctx)).not.toThrow();
});

test("a delivery method nobody serves yet is refused as not found", async () => {
  const deliver = { method: "deliver", projectId: "p", ticketId: "t1" } as const;
  await expect(dispatchRpc(service, [], deliver, ctx, [])).rejects.toThrow("NOT_FOUND");
  const ext = { methods: ["deliver"] as const, handle: async () => "served" };
  expect(await dispatchRpc(service, [ext], deliver, ctx, [])).toBe("served");
});
