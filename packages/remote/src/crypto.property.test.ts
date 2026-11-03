import { expect, test } from "bun:test";
import fc from "fast-check";
import { deriveKeys, generateRootKey, openRequest, openSnapshot, sealRequest, sealSnapshot } from "./crypto";

const keys = deriveKeys(generateRootKey(), "acc-1", 1);
const plaintext = fc.uint8Array({ maxLength: 65_536 });
const id = fc.string({ minLength: 1, maxLength: 40 });
const kind = fc.oneof(
  fc.constantFrom("projects", "project", "events", "agent", "ci", "t3"),
  fc
    .tuple(fc.stringMatching(/^[^:]+$/), fc.stringMatching(/^[^:]+$/))
    .map(([question, image]) => `image:${question}:${image}`),
);
const snapshotHeader = fc.record({
  v: fc.constant(1 as const),
  projectId: id,
  kind,
  seq: fc.nat(),
  builtAt: fc.integer(),
  keyEpoch: fc.constant(1),
});
const requestHeader = fc.record({
  v: fc.constant(1 as const),
  requestId: fc.uuid(),
  projectId: fc.option(id, { nil: null }),
  at: fc.integer(),
  keyEpoch: fc.constant(1),
});

test("open(seal(x)) = x for every snapshot header and plaintext up to 64 KiB", async () => {
  const k = await keys;
  await fc.assert(
    fc.asyncProperty(snapshotHeader, plaintext, async (header, bytes) => {
      expect(await openSnapshot(k, await sealSnapshot(k, header, bytes))).toEqual(bytes);
    }),
    { numRuns: 60 },
  );
});

test("open(seal(x)) = x for every request header and plaintext up to 64 KiB", async () => {
  const k = await keys;
  await fc.assert(
    fc.asyncProperty(requestHeader, plaintext, async (header, bytes) => {
      expect(await openRequest(k, await sealRequest(k, header, bytes))).toEqual(bytes);
    }),
    { numRuns: 60 },
  );
});
