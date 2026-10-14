import { expect, test } from "bun:test";
import { DELIVERY_RPC, DELIVERY_RPC_METHODS, isDeliveryRequest } from "./delivery-rpc";
import { RpcRequest } from "./rpc";

const ok = (raw: unknown) => RpcRequest.safeParse(raw).success;

test("the delivery requests parse", () => {
  expect(DELIVERY_RPC_METHODS).toEqual([
    "agents.applyPreset",
    "deliver",
    "setDeliveryStep",
    "runs.denials",
    "runs.allowAndResume",
    "projects.importDelivery",
    "projects.applyDeliveryImport",
  ]);
  expect(DELIVERY_RPC).toHaveLength(7);
  expect(ok({ method: "agents.applyPreset", ref: "global:full-delivery", preset: "delivery" })).toBe(true);
  expect(ok({ method: "agents.applyPreset", ref: "global:full-delivery", preset: "review" })).toBe(false);
  expect(ok({ method: "deliver", projectId: "p", ticketId: "t1" })).toBe(true);
  expect(
    ok({ method: "setDeliveryStep", projectId: "p", ticketKey: "EMIS-15", step: 7, note: "gates" }),
  ).toBe(true);
  expect(ok({ method: "setDeliveryStep", projectId: "p", ticketKey: "EMIS-15", step: 7 })).toBe(true);
  expect(ok({ method: "setDeliveryStep", projectId: "p", ticketKey: "EMIS-15", step: 12 })).toBe(false);
  expect(ok({ method: "setDeliveryStep", projectId: "p", ticketKey: "emis", step: 1 })).toBe(false);
  expect(ok({ method: "runs.denials", runId: "r1" })).toBe(true);
  const allow = {
    method: "runs.allowAndResume",
    runId: "r1",
    questionId: "q1",
    rules: ["Bash(pnpm *)"],
    addDirs: [],
  };
  expect(ok(allow)).toBe(true);
  expect(ok({ ...allow, rules: ["Bash(sh *)"] })).toBe(false);
  expect(ok({ method: "projects.importDelivery" })).toBe(true);
  expect(ok({ method: "projects.importDelivery", registryPath: "relative.json" })).toBe(false);
  expect(ok({ method: "projects.applyDeliveryImport", projectId: "p", name: "emis" })).toBe(true);
});

test("delivery requests are recognised by their method", () => {
  expect(isDeliveryRequest({ method: "deliver" })).toBe(true);
  expect(isDeliveryRequest({ method: "assignAgent" })).toBe(false);
});
