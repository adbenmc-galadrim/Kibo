import { describe, expect, test } from "bun:test";
import {
  CLOSE_CODES,
  ClientFrame,
  challengePayload,
  encodeFrame,
  JoinRequest,
  MAX_FRAME_BYTES,
  Phase7Event,
  parseClientFrame,
  parseServerFrame,
  ServerFrame,
  SYNC_LIMITS,
} from "./sync";

describe("client frames", () => {
  test("accepts every client frame type", () => {
    const frames = [
      { type: "auth", deviceId: "d1", signature: "c2ln" },
      { type: "subscribe", projectId: "p1", version: null },
      { type: "subscribe", projectId: "p1", version: "AAAA" },
      { type: "unsubscribe", projectId: "p1" },
      { type: "push", projectId: "p1", bytes: "AAAA", clientBatchId: "b1" },
      { type: "presence", projectId: "p1", bytes: "AAAA" },
      { type: "share", projectId: "p1", requestId: "r1", name: "Kibo", snapshot: "AAAA" },
      { type: "invite", projectId: "p1", requestId: "r2", role: "editor" },
      { type: "redeem", requestId: "r3", code: "ABCD" },
      { type: "set-role", projectId: "p1", requestId: "r4", userId: "u2", role: null },
      { type: "unshare", projectId: "p1", requestId: "r5" },
      { type: "device-invite", requestId: "r6" },
      { type: "list-devices", requestId: "r7" },
      { type: "revoke-device", requestId: "r8", deviceId: "d2" },
    ];
    for (const f of frames) expect(ClientFrame.safeParse(f).success).toBe(true);
  });

  test("refuses unknown types, invalid base64 and owner invitations", () => {
    expect(ClientFrame.safeParse({ type: "hello" }).success).toBe(false);
    expect(
      ClientFrame.safeParse({ type: "push", projectId: "p1", bytes: "@@", clientBatchId: "b" }).success,
    ).toBe(false);
    expect(
      ClientFrame.safeParse({ type: "push", projectId: "p1", bytes: "abc", clientBatchId: "b" }).success,
    ).toBe(false);
    expect(
      ClientFrame.safeParse({ type: "invite", projectId: "p1", requestId: "r", role: "owner" }).success,
    ).toBe(false);
    expect(ClientFrame.safeParse({ type: "subscribe", projectId: "", version: null }).success).toBe(false);
  });
});

describe("server frames", () => {
  test("accepts every server frame type", () => {
    const frames = [
      { type: "challenge", nonce: "AAAA" },
      {
        type: "welcome",
        userId: "u1",
        name: "Adam",
        deviceId: "d1",
        projects: [{ id: "p1", name: "Kibo", role: "owner" }],
      },
      { type: "update", projectId: "p1", bytes: "AAAA", serverSeq: 3, version: "AAAA" },
      { type: "ack", projectId: "p1", clientBatchId: "b1", serverSeq: 4, version: "AAAA" },
      {
        type: "reject",
        projectId: "p1",
        clientBatchId: "b1",
        code: "OUT_OF_DATE",
        message: "gap",
        version: "AAAA",
      },
      {
        type: "reject",
        projectId: "p1",
        clientBatchId: "b1",
        code: "UPDATE_REJECTED",
        message: "key",
        version: null,
      },
      { type: "presence", projectId: "p1", bytes: "AAAA" },
      { type: "members", projectId: "p1", members: [{ userId: "u1", name: "Adam", role: "owner" }] },
      { type: "invite-code", requestId: "r1", code: "ABCD", expiresAt: 1 },
      { type: "shared", requestId: "r1", projectId: "p1" },
      { type: "joined", requestId: "r1", projectId: "p1", name: "Kibo", role: "viewer" },
      { type: "revoked", projectId: "p1", reason: "removed" },
      {
        type: "devices",
        requestId: "r1",
        devices: [{ deviceId: "d1", name: "Mac", createdAt: 1, lastSeenAt: null, revokedAt: null }],
      },
      { type: "done", requestId: "r1" },
      { type: "error", requestId: null, code: "FORBIDDEN", message: "owner only" },
    ];
    for (const f of frames) expect(ServerFrame.safeParse(f).success).toBe(true);
  });

  test("refuses a negative serverSeq and an unknown reject code", () => {
    expect(
      ServerFrame.safeParse({
        type: "update",
        projectId: "p1",
        bytes: "AAAA",
        serverSeq: -1,
        version: "AAAA",
      }).success,
    ).toBe(false);
    expect(
      ServerFrame.safeParse({
        type: "reject",
        projectId: "p1",
        clientBatchId: "b",
        code: "NOPE",
        message: "",
        version: null,
      }).success,
    ).toBe(false);
  });
});

describe("parsing helpers", () => {
  test("round-trip through encodeFrame", () => {
    const frame = { type: "push", projectId: "p1", bytes: "AAAA", clientBatchId: "b1" } as const;
    expect(parseClientFrame(encodeFrame(frame))).toEqual(frame);
    expect(parseServerFrame(encodeFrame({ type: "done", requestId: "r" }))).toEqual({
      type: "done",
      requestId: "r",
    });
  });

  test("invalid JSON, invalid shape and oversized frames are input errors", () => {
    expect(() => parseClientFrame("{")).toThrow("INVALID_INPUT");
    expect(() => parseClientFrame('{"type":"nope"}')).toThrow("INVALID_INPUT");
    expect(() => parseServerFrame("x".repeat(MAX_FRAME_BYTES + 1))).toThrow("INVALID_INPUT");
  });
});

describe("daemon events", () => {
  test("phase 7 events do not reuse integration event types", () => {
    expect(Phase7Event.safeParse({ type: "presence.changed", projectId: "p1" }).success).toBe(true);
    expect(Phase7Event.safeParse({ type: "collab.changed" }).success).toBe(true);
    expect(Phase7Event.safeParse({ type: "sync" }).success).toBe(false);
  });
});

describe("constants", () => {
  test("challenge payload is deterministic and bound to the origin", () => {
    const a = challengePayload("bm9uY2U=", "wss://sync.kibo.test");
    expect(new TextDecoder().decode(a)).toBe("kibo-sync-v1\nbm9uY2U=\nwss://sync.kibo.test");
    expect(challengePayload("bm9uY2U=", "wss://other.test")).not.toEqual(a);
  });

  test("limits and close codes match spec G", () => {
    expect(MAX_FRAME_BYTES).toBe(8 * 1024 * 1024);
    expect(SYNC_LIMITS).toMatchObject({
      batchMs: 50,
      projectBytes: 50 * 1024 * 1024,
      updatesPerSecond: 100,
      connectionsPerUser: 20,
      authFailuresPerMinute: 5,
      authBlockMs: 5 * 60_000,
      compactEvery: 500,
      unloadAfterMs: 10 * 60_000,
      backoffMinMs: 1000,
      backoffMaxMs: 60_000,
      presenceTimeoutMs: 30_000,
      presenceRefreshMs: 10_000,
      accountInviteMs: 48 * 3_600_000,
      deviceInviteMs: 15 * 60_000,
      projectInviteMs: 48 * 3_600_000,
    });
    expect(CLOSE_CODES).toEqual({
      authFailed: 4401,
      deviceRevoked: 4403,
      accessRevoked: 4404,
      tooManyConnections: 4429,
    });
  });

  test("join request trims and bounds the device name", () => {
    expect(JoinRequest.safeParse({ code: "ABCD", publicKey: "AAAA", deviceName: "  Mac  " }).success).toBe(
      true,
    );
    expect(JoinRequest.safeParse({ code: "ABCD", publicKey: "AAAA", deviceName: "   " }).success).toBe(false);
  });
});
