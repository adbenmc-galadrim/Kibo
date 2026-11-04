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
  await s.send(encode({ method: "getSession" }));
  expect(s.calls).toEqual([{ req: { method: "getSession" }, ctx: { sessionHash: "phone", remote: true } }]);
});

test("the response is { ok: true, result }", async () => {
  const s = setup();
  expect(await s.send(encode({ method: "getSession" }))).toEqual({
    ok: true,
    result: { id: "p1" },
  });
});

test("an undefined result is answered as null", async () => {
  const s = setup(() => undefined);
  expect(await s.send(encode({ method: "getSession" }))).toEqual({
    ok: true,
    result: null,
  });
});

test("a KiboError is answered { ok: false, error: { code, message } }", async () => {
  const s = setup(() => {
    throw new KiboError("NOT_FOUND", "project p1 not found");
  });
  expect(await s.send(encode({ method: "getSession" }))).toEqual({
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
    expect(await s.send(encode({ method: "getSession" }))).toEqual({
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
  const payload = encode({ method: "getSession" });
  expect(await s.send(payload, origin)).toMatchObject({ ok: true });
  expect(await s.send(payload, origin)).toMatchObject({ ok: false, error: { code: "REMOTE_REJECTED" } });
  expect(s.calls).toHaveLength(1);
});

test("a request older than the replay window is refused", async () => {
  const s = setup();
  const origin = { requestId: "req-old", at: T0 - 11 * 60_000 };
  expect(await s.send(encode({ method: "getSession" }), origin)).toMatchObject({
    ok: false,
    error: { code: "REMOTE_REJECTED" },
  });
  expect(s.calls).toEqual([]);
});

test("the error message is redacted before it reaches the phone", async () => {
  const s = setup(() => {
    throw new KiboError("REMOTE_REJECTED", "github 401: ghp_fakeSecret");
  });
  expect(await s.send(encode({ method: "getSession" }))).toEqual({
    ok: false,
    error: { code: "REMOTE_REJECTED", message: "github 401: ***" },
  });
});

test("a request more than ten minutes in the future is refused", async () => {
  const s = setup();
  const origin = { requestId: "req-future", at: T0 + 11 * 60_000 };
  expect(await s.send(encode({ method: "getSession" }), origin)).toMatchObject({
    ok: false,
    error: { code: "REMOTE_REJECTED" },
  });
  expect(s.calls).toEqual([]);
});

const LOCAL_PREVIEW = {
  argv: [
    "/Users/adam/.local/bin/t3",
    "thread",
    "start",
    "/Users/adam/Documents/silo",
    "/full-delivery SILO-45",
  ],
  command: 't3 thread start ~/Documents/silo "/full-delivery SILO-45"',
  folder: "~/Documents/silo",
  warning: null,
};
const PHONE_PREVIEW = {
  argv: [],
  command: 't3 thread start silo "/full-delivery SILO-45"',
  folder: "silo",
  warning: null,
};
const THREAD = {
  threadId: "th-1",
  link: "t3-thread://th-1",
  title: "SILO-45 · Photos",
  status: "running",
  startedAt: T0,
  checkedAt: T0,
};
const onSilo45 = { projectId: "p1", instanceId: "phone:kanban" };

const t3Answer = (req: RpcRequest): unknown => {
  const kind = req.method === "componentCall" ? req.call.kind : req.method;
  if (kind === "t3.preview") return LOCAL_PREVIEW;
  if (kind === "t3.launch") return { thread: THREAD, command: LOCAL_PREVIEW.command };
  return null;
};

test("the launch preview reaches the phone with the folder name only, as a component call or an rpc", async () => {
  const s = setup(t3Answer);
  const viaCall = {
    method: "componentCall",
    ...onSilo45,
    call: { kind: "t3.preview", ticketKey: "SILO-45" },
  };
  expect(await s.send(encode(viaCall))).toEqual({ ok: true, result: PHONE_PREVIEW });
  const viaRpc = { method: "t3.preview", projectId: "p1", ticketKey: "SILO-45" };
  expect(await s.send(encode(viaRpc))).toEqual({ ok: true, result: PHONE_PREVIEW });
});

test("a launch from the phone runs once on the Mac and answers the command with the folder name only", async () => {
  const s = setup(t3Answer);
  const req = { method: "componentCall", ...onSilo45, call: { kind: "t3.launch", ticketKey: "SILO-45" } };
  const response = await s.send(encode(req));
  expect(response).toEqual({ ok: true, result: { thread: THREAD, command: PHONE_PREVIEW.command } });
  const launches = s.calls.filter((c) => c.req.method === "componentCall" && c.req.call.kind === "t3.launch");
  expect(launches).toHaveLength(1);
  expect(JSON.stringify(response)).not.toContain("/Users");
});

test("getProject reaches the phone with the folder name only", async () => {
  const s = setup(() => ({ meta: { id: "p1", folder: "/Users/adam/Documents/silo" }, tickets: [] }));
  expect(await s.send(encode({ method: "getProject", projectId: "p1" }))).toEqual({
    ok: true,
    result: {
      meta: { id: "p1", folder: "silo", worktree: null, storybook: null, delivery: null },
      tickets: [],
    },
  });
});

test("a launch whose folder cannot be previewed is refused before anything starts on the Mac", async () => {
  const s = setup((req) => {
    if (req.method === "componentCall" && req.call.kind === "t3.preview")
      throw new KiboError("PROJECT_FOLDER_MISSING", "project p1 has no folder");
    return t3Answer(req);
  });
  const req = { method: "componentCall", ...onSilo45, call: { kind: "t3.launch", ticketKey: "SILO-45" } };
  expect(await s.send(encode(req))).toMatchObject({ ok: false, error: { code: "PROJECT_FOLDER_MISSING" } });
  expect(s.calls.map((c) => (c.req.method === "componentCall" ? c.req.call.kind : c.req.method))).toEqual([
    "t3.preview",
  ]);
});
