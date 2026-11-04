import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import {
  canonicalHeader,
  deriveKeys,
  generateRootKey,
  openReply,
  openRequest,
  openSnapshot,
  sealReply,
  sealRequest,
  sealSnapshot,
} from "./crypto";
import type { RequestHeader, SnapshotHeader } from "./protocol";

const header: SnapshotHeader = {
  v: 1,
  projectId: "p1",
  kind: "project",
  seq: 4,
  builtAt: 1_700_000_000_000,
  keyEpoch: 1,
};
const requestHeader: RequestHeader = {
  v: 1,
  requestId: "6f1c2a4e-9b1d-4c7e-8a2f-3d5e7f9a1b2c",
  projectId: "p1",
  at: 1_700_000_000_000,
  keyEpoch: 1,
};
const text = (value: string) => new TextEncoder().encode(value);

const rejection = async (work: Promise<unknown>): Promise<string | null> => {
  try {
    await work;
    return null;
  } catch (error) {
    return error instanceof KiboError ? error.code : "not a KiboError";
  }
};

describe("crypto", () => {
  test("the root key has 32 random bytes", () => {
    const a = generateRootKey();
    expect(a.byteLength).toBe(32);
    expect(generateRootKey()).not.toEqual(a);
  });

  test("seal then open returns the plaintext", async () => {
    const keys = await deriveKeys(generateRootKey(), "acc-1", 1);
    const sealed = await sealSnapshot(keys, header, text("Silo"));
    expect(sealed.header).toEqual(header);
    expect(await openSnapshot(keys, sealed)).toEqual(text("Silo"));
    const request = await sealRequest(keys, requestHeader, text("{}"));
    expect(await openRequest(keys, request)).toEqual(text("{}"));
  });

  test("open with the other direction key throws REMOTE_REJECTED", async () => {
    const keys = await deriveKeys(generateRootKey(), "acc-1", 1);
    const swapped = { snapshot: keys.request, request: keys.snapshot, epoch: 1 };
    const sealed = await sealSnapshot(keys, header, text("Silo"));
    expect(await rejection(openSnapshot(swapped, sealed))).toBe("REMOTE_REJECTED");
    const request = await sealRequest(keys, requestHeader, text("{}"));
    expect(await rejection(openRequest(swapped, request))).toBe("REMOTE_REJECTED");
  });

  test("a request sent back by the server as its reply throws REMOTE_REJECTED, and the other way", async () => {
    const keys = await deriveKeys(generateRootKey(), "acc-1", 1);
    const request = await sealRequest(keys, requestHeader, text('{"method":"getSession"}'));
    expect(await rejection(openReply(keys, request))).toBe("REMOTE_REJECTED");
    const reply = await sealReply(keys, requestHeader, text('{"ok":true}'));
    expect(await openReply(keys, reply)).toEqual(text('{"ok":true}'));
    expect(await rejection(openRequest(keys, reply))).toBe("REMOTE_REJECTED");
  });

  test("a modified header (seq + 1) throws REMOTE_REJECTED", async () => {
    const keys = await deriveKeys(generateRootKey(), "acc-1", 1);
    const sealed = await sealSnapshot(keys, header, text("Silo"));
    const moved = { ...sealed, header: { ...header, seq: header.seq + 1 } };
    expect(await rejection(openSnapshot(keys, moved))).toBe("REMOTE_REJECTED");
    const request = await sealRequest(keys, requestHeader, text("{}"));
    const replayed = { ...request, header: { ...requestHeader, at: requestHeader.at + 1 } };
    expect(await rejection(openRequest(keys, replayed))).toBe("REMOTE_REJECTED");
  });

  test("a tampered ciphertext or a malformed nonce throws REMOTE_REJECTED", async () => {
    const keys = await deriveKeys(generateRootKey(), "acc-1", 1);
    const sealed = await sealSnapshot(keys, header, text("Silo"));
    const flipped = `${sealed.ciphertext[0] === "A" ? "B" : "A"}${sealed.ciphertext.slice(1)}`;
    expect(await rejection(openSnapshot(keys, { ...sealed, ciphertext: flipped }))).toBe("REMOTE_REJECTED");
    expect(await rejection(openSnapshot(keys, { ...sealed, nonce: "AAAA" }))).toBe("REMOTE_REJECTED");
  });

  test("a block sealed for another key epoch throws REMOTE_REJECTED", async () => {
    const keys = await deriveKeys(generateRootKey(), "acc-1", 1);
    const sealed = await sealSnapshot(keys, header, text("Silo"));
    const relabelled = { ...sealed, header: { ...header, keyEpoch: 2 } };
    expect(await rejection(openSnapshot({ ...keys, epoch: 2 }, relabelled))).toBe("REMOTE_REJECTED");
    expect(await rejection(sealSnapshot(keys, { ...header, keyEpoch: 2 }, text("Silo")))).toBe(
      "REMOTE_REJECTED",
    );
  });

  test("two seals of the same plaintext differ (nonce)", async () => {
    const keys = await deriveKeys(generateRootKey(), "acc-1", 1);
    const a = await sealSnapshot(keys, header, text("Silo"));
    const b = await sealSnapshot(keys, header, text("Silo"));
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.nonce).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(a.ciphertext).not.toContain("=");
  });

  test("deriveKeys is deterministic for the same root, account and epoch", async () => {
    const root = generateRootKey();
    const mac = await deriveKeys(root, "acc-1", 1);
    const phone = await deriveKeys(new Uint8Array(root), "acc-1", 1);
    expect(phone.epoch).toBe(1);
    expect(phone.snapshot.extractable).toBe(false);
    expect(phone.snapshot.algorithm.name).toBe("AES-GCM");
    expect(phone.snapshot.usages.sort()).toEqual(["decrypt", "encrypt"]);
    expect(await openSnapshot(phone, await sealSnapshot(mac, header, text("Silo")))).toEqual(text("Silo"));
    expect(await openRequest(mac, await sealRequest(phone, requestHeader, text("{}")))).toEqual(text("{}"));
  });

  test("deriveKeys differs by epoch and by account", async () => {
    const root = generateRootKey();
    const first = await deriveKeys(root, "acc-1", 1);
    const second = await deriveKeys(root, "acc-1", 2);
    const other = await deriveKeys(root, "acc-2", 1);
    const sealed = await sealSnapshot(first, header, text("Silo"));
    expect(await rejection(openSnapshot({ ...second, epoch: 1 }, sealed))).toBe("REMOTE_REJECTED");
    expect(await rejection(openSnapshot(other, sealed))).toBe("REMOTE_REJECTED");
  });

  test("the canonical header sorts the keys", () => {
    const shuffled: SnapshotHeader = {
      seq: 4,
      v: 1,
      kind: "project",
      keyEpoch: 1,
      projectId: "p1",
      builtAt: 1_700_000_000_000,
    };
    const expected = '{"builtAt":1700000000000,"keyEpoch":1,"kind":"project","projectId":"p1","seq":4,"v":1}';
    expect(new TextDecoder().decode(canonicalHeader(shuffled))).toBe(expected);
    expect(canonicalHeader(shuffled)).toEqual(canonicalHeader(header));
  });
});
