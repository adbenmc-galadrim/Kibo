import { expect, test } from "bun:test";
import { KIBO_ERROR_CODES } from "./errors";
import { RpcRequest } from "./rpc";
import { startReasonText } from "./startability";
import { T3_RPC_METHODS, T3Preview, T3Status } from "./t3-rpc";
import { isActiveT3Status, T3Thread } from "./t3-thread";

const thread = { threadId: "t", link: "l", title: "x", status: "waiting", startedAt: 1, checkedAt: 2 };

test("a thread only accepts the four reduced statuses", () => {
  expect(T3Thread.parse(thread).status).toBe("waiting");
  expect(T3Thread.safeParse({ ...thread, status: "completed" }).success).toBe(false);
});

test("running and waiting are the active statuses", () => {
  expect(["running", "waiting", "done", "failed"].filter((s) => isActiveT3Status(s))).toEqual([
    "running",
    "waiting",
  ]);
});

test("every t3 method is part of the RPC request union", () => {
  expect(T3_RPC_METHODS).toEqual(["t3.status", "t3.preview", "t3.launch", "t3.threadOf", "t3.refresh"]);
  expect(RpcRequest.parse({ method: "t3.status" }).method).toBe("t3.status");
  const launch = { method: "t3.launch", projectId: "p", ticketKey: "SILO-45" };
  expect(RpcRequest.parse(launch).method).toBe("t3.launch");
  expect(RpcRequest.safeParse({ ...launch, ticketKey: "--help" }).success).toBe(false);
});

test("status and preview carry the contract fields", () => {
  expect(T3Status.parse({ available: false, reason: "server-down", bin: "t3" }).reason).toBe("server-down");
  expect(T3Preview.parse({ argv: ["t3"], command: "t3", folder: "/f", warning: null }).warning).toBeNull();
});

test("the t3 error codes are stable", () => {
  for (const code of ["T3_MISSING", "T3_UNAVAILABLE", "T3_THREAD_ACTIVE", "T3_FAILED"] as const)
    expect(KIBO_ERROR_CODES).toContain(code);
});

test("the start reason text is shared with the copy button", () => {
  expect(startReasonText({ kind: "dependency", keys: ["SILO-33"] })).toBe("attend SILO-33");
  expect(startReasonText({ kind: "limit", limit: 2, count: 2 })).toBe("limite 2/2 atteinte");
  expect(startReasonText({ kind: "status" })).toBeNull();
});
