import { expect, test } from "bun:test";
import { deriveKeys, generateRootKey, openRequest, sealRequest } from "@kibo/remote";
import { createReplayGuard } from "./replay-guard";
import { createRequestHandler } from "./request-handler";

const T0 = 1_760_000_000_000;
const utf8 = new TextEncoder();

async function setup() {
  const keys = await deriveKeys(generateRootKey(), "acc", 2);
  const gate = {
    dispatch: async () => ({ id: "silo" }),
    seen: createReplayGuard(),
    startedAt: 0,
    now: () => T0,
    redact: (text: string) => text,
  };
  const header = { v: 1 as const, requestId: crypto.randomUUID(), projectId: "silo", at: T0, keyEpoch: 2 };
  const sealed = await sealRequest(keys, header, utf8.encode(JSON.stringify({ method: "getSession" })));
  return { keys, gate, header, message: { type: "request" as const, requestId: header.requestId, sealed } };
}

test("the reply is sealed with the request header and answers through the gate", async () => {
  const s = await setup();
  const reply = await createRequestHandler({ keys: () => s.keys, gate: s.gate })(s.message);
  expect(reply?.requestId).toBe(s.header.requestId);
  expect(reply?.sealed.header).toEqual(s.header);
  if (!reply) throw new Error("no reply");
  expect(JSON.parse(new TextDecoder().decode(await openRequest(s.keys, reply.sealed)))).toEqual({
    ok: true,
    result: { id: "silo" },
  });
});

test("a request from an older key epoch is answered REMOTE_REJECTED under the current epoch", async () => {
  const s = await setup();
  const current = await deriveKeys(generateRootKey(), "acc", 3);
  const reply = await createRequestHandler({ keys: () => current, gate: s.gate })(s.message);
  if (!reply) throw new Error("no reply");
  expect(reply.sealed.header.keyEpoch).toBe(3);
  expect(JSON.parse(new TextDecoder().decode(await openRequest(current, reply.sealed)))).toMatchObject({
    ok: false,
    error: { code: "REMOTE_REJECTED" },
  });
});

test("without keys nothing is answered", async () => {
  const s = await setup();
  expect(await createRequestHandler({ keys: () => null, gate: s.gate })(s.message)).toBeNull();
});
