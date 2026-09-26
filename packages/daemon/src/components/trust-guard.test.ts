import { expect, test } from "bun:test";
import { componentTrustGuard } from "./trust-guard";

const local = { sessionHash: "a".repeat(64), remote: false };
const remote = { sessionHash: "b".repeat(64), remote: true };
const approve = {
  method: "approveComponent",
  id: "hello",
  version: "0.1.0",
  hash: "c".repeat(64),
  trust: "sandboxed",
} as const;
const publish = { method: "publishComponent", id: "hello", strategy: "new-version" } as const;

test("granting trust to a component is refused from a remote session", async () => {
  await expect(componentTrustGuard(approve, remote)).rejects.toThrow("FORBIDDEN");
  await expect(componentTrustGuard(publish, remote)).rejects.toThrow("FORBIDDEN");
});

test("a local session and other methods go on to the next handler", async () => {
  expect(await componentTrustGuard(approve, local)).toEqual({ handled: false });
  expect(await componentTrustGuard(publish, local)).toEqual({ handled: false });
  expect(await componentTrustGuard({ method: "listComponents" }, remote)).toEqual({ handled: false });
  expect(
    await componentTrustGuard({ method: "revokeComponent", id: "hello", version: "0.1.0" }, remote),
  ).toEqual({ handled: false });
});
