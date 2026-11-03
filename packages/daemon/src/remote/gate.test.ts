import { expect, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import type { RpcContext } from "../rpc-extensions";
import { handleRemoteRequest } from "./gate";
import { createReplayGuard } from "./replay-guard";

const T0 = 1_760_000_000_000;
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const decode = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(bytes));

type Call = { req: RpcRequest; ctx: RpcContext };

function setup(answer: (req: RpcRequest) => unknown = () => ({ id: "p1" })) {
  const calls: Call[] = [];
  const deps = {
    dispatch: async (req: RpcRequest, ctx: RpcContext) => {
      calls.push({ req, ctx });
      return answer(req);
    },
    seen: createReplayGuard(),
    now: () => T0,
    redact: (text: string) => text.replaceAll("ghp_fakeSecret", "***"),
  };
  let next = 0;
  const send = async (payload: Uint8Array, origin = { requestId: `req-${next++}`, at: T0 }) =>
    decode(await handleRemoteRequest(deps, payload, origin));
  return { calls, send };
}

test("a method outside the list is refused before dispatch", async () => {
  const s = setup();
  expect(await s.send(encode({ method: "resetProjectAgent", projectId: "p1" }))).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN" },
  });
  expect(s.calls).toEqual([]);
});

test("command addPage is refused", async () => {
  const s = setup();
  const req = {
    method: "command",
    projectId: "p1",
    command: { method: "addPage", title: "Vue", kind: "view" },
  };
  expect(await s.send(encode(req))).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  expect(s.calls).toEqual([]);
});

test("an allowed request is dispatched with remote: true and sessionHash phone", async () => {
  const s = setup();
  await s.send(encode({ method: "getProject", projectId: "p1" }));
  expect(s.calls).toEqual([
    { req: { method: "getProject", projectId: "p1" }, ctx: { sessionHash: "phone", remote: true } },
  ]);
});

test("the response is { ok: true, result }", async () => {
  const s = setup();
  expect(await s.send(encode({ method: "getProject", projectId: "p1" }))).toEqual({
    ok: true,
    result: { id: "p1" },
  });
});

test("an undefined result is answered as null", async () => {
  const s = setup(() => undefined);
  expect(await s.send(encode({ method: "getProject", projectId: "p1" }))).toEqual({ ok: true, result: null });
});

test("a KiboError is answered { ok: false, error: { code, message } }", async () => {
  const s = setup(() => {
    throw new KiboError("NOT_FOUND", "project p1 not found");
  });
  expect(await s.send(encode({ method: "getProject", projectId: "p1" }))).toEqual({
    ok: false,
    error: { code: "NOT_FOUND", message: "project p1 not found" },
  });
});

test("an unexpected error is answered as an internal error without its detail", async () => {
  const s = setup(() => {
    throw new Error("secret detail");
  });
  const original = console.error;
  console.error = () => {};
  try {
    expect(await s.send(encode({ method: "getProject", projectId: "p1" }))).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: "internal error" },
    });
  } finally {
    console.error = original;
  }
});

test("an unparsable payload yields INVALID_INPUT", async () => {
  const s = setup();
  expect(await s.send(new TextEncoder().encode("{not json"))).toMatchObject({
    ok: false,
    error: { code: "INVALID_INPUT" },
  });
  expect(await s.send(encode({ method: "getProject" }))).toMatchObject({
    ok: false,
    error: { code: "INVALID_INPUT", message: "invalid request: projectId" },
  });
  expect(s.calls).toEqual([]);
});

test("a replayed request id is refused without a second dispatch", async () => {
  const s = setup();
  const origin = { requestId: "req-same", at: T0 };
  const payload = encode({ method: "getProject", projectId: "p1" });
  expect(await s.send(payload, origin)).toMatchObject({ ok: true });
  expect(await s.send(payload, origin)).toMatchObject({ ok: false, error: { code: "REMOTE_REJECTED" } });
  expect(s.calls).toHaveLength(1);
});

test("a request older than the replay window is refused", async () => {
  const s = setup();
  const origin = { requestId: "req-old", at: T0 - 11 * 60_000 };
  expect(await s.send(encode({ method: "getProject", projectId: "p1" }), origin)).toMatchObject({
    ok: false,
    error: { code: "REMOTE_REJECTED" },
  });
  expect(s.calls).toEqual([]);
});

test("the error message is redacted before it reaches the phone", async () => {
  const s = setup(() => {
    throw new KiboError("REMOTE_REJECTED", "github 401: ghp_fakeSecret");
  });
  expect(await s.send(encode({ method: "getProject", projectId: "p1" }))).toEqual({
    ok: false,
    error: { code: "REMOTE_REJECTED", message: "github 401: ***" },
  });
});

test("a request more than ten minutes in the future is refused", async () => {
  const s = setup();
  const origin = { requestId: "req-future", at: T0 + 11 * 60_000 };
  expect(await s.send(encode({ method: "getProject", projectId: "p1" }), origin)).toMatchObject({
    ok: false,
    error: { code: "REMOTE_REJECTED" },
  });
  expect(s.calls).toEqual([]);
});
