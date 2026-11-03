import { describe, expect, test } from "bun:test";
import { MacMessage, PhoneEvent, Sealed, SealedRequest, ServerMessage } from "./protocol";
import { SnapshotKind } from "./snapshot-kinds";

const header = { v: 1, projectId: "p1", kind: "project", seq: 3, builtAt: 1_700_000_000_000, keyEpoch: 1 };
const sealed = { header, nonce: "AAAAAAAAAAAAAAAA", ciphertext: "q83vEjRWeJA" };
const requestHeader = {
  v: 1,
  requestId: "6f1c2a4e-9b1d-4c7e-8a2f-3d5e7f9a1b2c",
  projectId: null,
  at: 1_700_000_000_000,
  keyEpoch: 1,
};

describe("snapshot kinds", () => {
  test("accepts the fixed kinds and image kinds with a question and an image", () => {
    for (const kind of ["projects", "project", "events", "agent", "ci", "t3", "image:q1:i1"]) {
      expect(SnapshotKind.safeParse(kind).success).toBe(true);
    }
  });

  test("refuses an image kind without its image id and unknown kinds", () => {
    for (const kind of ["image:q1", "image::i1", "image:q1:i1:x", "notes", ""]) {
      expect(SnapshotKind.safeParse(kind).success).toBe(false);
    }
  });
});

describe("envelopes", () => {
  test("a mac snapshot.put carries a valid sealed block", () => {
    const message = MacMessage.parse({ type: "snapshot.put", sealed });
    expect(message.type).toBe("snapshot.put");
  });

  test("a sealed block refuses a header of another version or a non base64url nonce", () => {
    expect(Sealed.safeParse({ ...sealed, header: { ...header, v: 2 } }).success).toBe(false);
    expect(Sealed.safeParse({ ...sealed, nonce: "AAAA/AAAAAAAAAAA" }).success).toBe(false);
    expect(Sealed.safeParse({ ...sealed, nonce: "AAAA" }).success).toBe(false);
    expect(Sealed.safeParse({ ...sealed, ciphertext: "a=" }).success).toBe(false);
  });

  test("a sealed request accepts a request without project and refuses a non uuid id", () => {
    const request = { header: requestHeader, nonce: "AAAAAAAAAAAAAAAA", ciphertext: "q83v" };
    expect(SealedRequest.safeParse(request).success).toBe(true);
    const bad = { ...request, header: { ...requestHeader, requestId: "r1" } };
    expect(SealedRequest.safeParse(bad).success).toBe(false);
  });

  test("every mac message type parses", () => {
    const request = { header: requestHeader, nonce: "AAAAAAAAAAAAAAAA", ciphertext: "q83v" };
    const messages = [
      { type: "snapshot.remove", projectId: "p1", kind: "image:q1:i1" },
      { type: "project.remove", projectId: "p1" },
      { type: "pair.create" },
      { type: "phone.revoke" },
      { type: "request.reply", requestId: requestHeader.requestId, sealed: request },
      { type: "ping", at: 1 },
    ];
    for (const message of messages) expect(MacMessage.safeParse(message).success).toBe(true);
  });

  test("the server refuses an unknown message type", () => {
    expect(ServerMessage.safeParse({ type: "snapshot.put", sealed }).success).toBe(false);
    expect(ServerMessage.safeParse({ type: "pong", at: 1 }).success).toBe(true);
    expect(ServerMessage.safeParse({ type: "error", code: "REMOTE_TOO_LARGE", message: "x" }).success).toBe(
      true,
    );
    expect(ServerMessage.safeParse({ type: "error", code: "NOPE", message: "x" }).success).toBe(false);
  });

  test("phone events carry the presence of the mac", () => {
    const presence = PhoneEvent.parse({ type: "mac.presence", online: false, lastSeenAt: null });
    expect(presence.type).toBe("mac.presence");
    expect(
      PhoneEvent.safeParse({ type: "snapshot.changed", projectId: "p1", kind: "ci", seq: 2 }).success,
    ).toBe(true);
  });
});
