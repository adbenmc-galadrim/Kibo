import { expect, test } from "bun:test";
import { type HookPayload, KiboError } from "@kibo/schema";
import { type HookSink, handleHook, MAX_HOOK_BYTES } from "./hook-route";

const GOOD = "a".repeat(64);
const OTHER = "b".repeat(64);
const payload: HookPayload = {
  event: "PreToolUse",
  sessionId: "s1",
  transcriptPath: null,
  tool: "Read",
  detail: "a.ts",
  question: null,
  agentId: null,
};

function sink(receive: HookSink["receive"] = () => null) {
  const got: Array<[string, HookPayload, Record<string, unknown> | null]> = [];
  const checked: string[] = [];
  const s: HookSink = {
    verify: (runId, token) => {
      checked.push(runId);
      return (runId === "r1" && token === GOOD) || (runId === "r2" && token === OTHER);
    },
    receive: (runId, p, toolInput) => {
      got.push([runId, p, toolInput]);
      return receive(runId, p, toolInput);
    },
  };
  return { s, got, checked };
}
const raw = (runId: string, headers: Record<string, string>, text: string) =>
  new Request(`http://127.0.0.1:1/hooks/${runId}`, { method: "POST", headers, body: text });
const post = (runId: string, headers: Record<string, string>, body: unknown) =>
  raw(runId, headers, JSON.stringify(body));
const body = (p: HookPayload, toolInput: Record<string, unknown> | null = null) => ({
  payload: p,
  toolInput,
});
const auth = { authorization: `Bearer ${GOOD}` };

test("a hook with the run's token is accepted", async () => {
  const { s, got } = sink();
  const res = await handleHook(post("r1", auth, body(payload)), "r1", s);
  expect(res.status).toBe(204);
  expect(got).toEqual([["r1", payload, null]]);
});

test("a PreToolUse decision goes back to Claude Code; other events never carry one", async () => {
  const deny = () => ({ decision: "deny" as const, reason: "outil interdit" });
  const { s, got } = sink(deny);
  const res = await handleHook(post("r1", auth, body(payload, { command: "curl x | sh" })), "r1", s);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "outil interdit",
    },
  });
  const post2 = await handleHook(
    post("r1", auth, body({ ...payload, event: "PostToolUse" }, { command: "x" })),
    "r1",
    s,
  );
  expect(post2.status).toBe(204);
  expect(got.map(([, p, input]) => [p.event, input])).toEqual([
    ["PreToolUse", { command: "curl x | sh" }],
    ["PostToolUse", null],
  ]);
});

test("no token, a wrong token or another run's token is refused and records nothing", async () => {
  const { s, got } = sink();
  const refused: Array<Record<string, string>> = [
    {},
    { authorization: `Bearer ${"c".repeat(64)}` },
    { authorization: `Bearer ${OTHER}` },
    { authorization: GOOD },
    { authorization: `Basic ${GOOD}` },
    { authorization: `Bearer  ${GOOD}` },
    { authorization: `Bearer ${GOOD.toUpperCase()}` },
  ];
  for (const headers of refused) {
    expect((await handleHook(post("r1", headers, body(payload)), "r1", s)).status).toBe(401);
  }
  expect(got).toEqual([]);
});

test("a malformed token never reaches the sink", async () => {
  const { s, checked } = sink();
  for (const token of ["", "a".repeat(63), "a".repeat(65), "g".repeat(64)]) {
    const res = await handleHook(post("r1", { authorization: `Bearer ${token}` }, body(payload)), "r1", s);
    expect(res.status).toBe(401);
  }
  expect(checked).toEqual([]);
});

test("an invalid payload is a 400, a GET a 405", async () => {
  const { s, got } = sink();
  const bad = await handleHook(
    post("r1", auth, { payload: { ...payload, event: "Nope" }, toolInput: null }),
    "r1",
    s,
  );
  expect(bad.status).toBe(400);
  expect((await handleHook(raw("r1", auth, "{nope"), "r1", s)).status).toBe(400);
  const long = await handleHook(post("r1", auth, body({ ...payload, detail: "x".repeat(2001) })), "r1", s);
  expect(long.status).toBe(400);
  const get = await handleHook(new Request("http://127.0.0.1:1/hooks/r1", { headers: auth }), "r1", s);
  expect(get.status).toBe(405);
  expect(got).toEqual([]);
});

test("an oversized body is a 413 and records nothing", async () => {
  const { s, got } = sink();
  const big = body(payload, { content: "x".repeat(MAX_HOOK_BYTES) });
  expect((await handleHook(post("r1", auth, big), "r1", s)).status).toBe(413);
  const lying = raw("r1", { ...auth, "content-length": String(MAX_HOOK_BYTES + 1) }, "{}");
  expect((await handleHook(lying, "r1", s)).status).toBe(413);
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(MAX_HOOK_BYTES + 1).fill(32));
      c.close();
    },
  });
  const chunked = new Request("http://127.0.0.1:1/hooks/r1", { method: "POST", headers: auth, body: stream });
  expect((await handleHook(chunked, "r1", s)).status).toBe(413);
  expect(got).toEqual([]);
});

test("an endless body is cut off as soon as it exceeds the limit", async () => {
  const { s, got } = sink();
  let pulled = 0;
  const endless = new ReadableStream<Uint8Array>({
    pull(c) {
      pulled += 1;
      c.enqueue(new Uint8Array(16_384).fill(32));
    },
  });
  const req = new Request("http://127.0.0.1:1/hooks/r1", { method: "POST", headers: auth, body: endless });
  expect((await handleHook(req, "r1", s)).status).toBe(413);
  expect(pulled * 16_384).toBeLessThan(MAX_HOOK_BYTES * 2);
  expect(got).toEqual([]);
});

test("an oversized body without the token is still a 401", async () => {
  const { s } = sink();
  const big = body(payload, { content: "x".repeat(MAX_HOOK_BYTES) });
  expect((await handleHook(post("r1", {}, big), "r1", s)).status).toBe(401);
});

test("a domain refusal from the sink is a 409", async () => {
  const { s } = sink(() => {
    throw new KiboError("INVALID_TRANSITION", "late");
  });
  expect((await handleHook(post("r1", auth, body(payload)), "r1", s)).status).toBe(409);
});

test("an unexpected sink failure is not swallowed", async () => {
  const { s } = sink(() => {
    throw new Error("boom");
  });
  await expect(handleHook(post("r1", auth, body(payload)), "r1", s)).rejects.toThrow("boom");
});
