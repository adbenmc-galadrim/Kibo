import { beforeEach, describe, expect, test } from "bun:test";
import { KiboError, SYNC_LIMITS } from "@kibo/schema";
import { generateKeyPair, toBase64 } from "@kibo/trust";
import {
  createInvite,
  deviceRecord,
  disableUser,
  listDevices,
  redeemDeviceInvite,
  redeemProjectInvite,
  revokeDevice,
} from "./accounts";
import { readAudit } from "./audit";
import { openServerDb, type ServerDb } from "./db";
import { insertProject, listMembers, projectsOf, roleOf, setRole } from "./members";

let sdb: ServerDb;
const T0 = 1_800_000_000_000;
beforeEach(() => {
  sdb = openServerDb(":memory:");
});

const code = async (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof KiboError ? e.code : "no-code"),
  );

const SMALL_ORDER_KEY = toBase64(
  new Uint8Array([
    0x30,
    0x2a,
    0x30,
    0x05,
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70,
    0x03,
    0x21,
    0x00,
    1,
    ...new Array(31).fill(0),
  ]),
);

async function account(name: string, now = T0) {
  const invite = await createInvite(sdb, { kind: "account", name, createdBy: "admin" }, now);
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(
    sdb,
    { code: invite.code, publicKey: keys.publicKey, deviceName: `Mac de ${name}` },
    now,
  );
  return { ...joined, keys };
}

describe("account invites", () => {
  test("a code is 26 base32 characters and is never stored in clear", async () => {
    const { code: c, expiresAt } = await createInvite(
      sdb,
      { kind: "account", name: "Adam", createdBy: "admin" },
      T0,
    );
    expect(c).toMatch(/^[A-Z2-7]{26}$/);
    expect(expiresAt).toBe(T0 + SYNC_LIMITS.accountInviteMs);
    const dump = JSON.stringify(sdb.db.query("SELECT * FROM invites").all());
    expect(dump).not.toContain(c);
  });
  test("redeeming creates the user and the device", async () => {
    const a = await account("Adam");
    expect(a.name).toBe("Adam");
    expect(deviceRecord(sdb, a.deviceId)).toMatchObject({
      userId: a.userId,
      name: "Adam",
      deviceName: "Mac de Adam",
      revoked: false,
    });
    expect(readAudit(sdb, 10).map((e) => e.kind)).toContain("invite-redeemed");
  });
  test("a code works only once", async () => {
    const invite = await createInvite(sdb, { kind: "account", name: "Adam", createdBy: "admin" }, T0);
    const k1 = await generateKeyPair();
    const k2 = await generateKeyPair();
    await redeemDeviceInvite(sdb, { code: invite.code, publicKey: k1.publicKey, deviceName: "A" }, T0);
    expect(
      await code(
        redeemDeviceInvite(sdb, { code: invite.code, publicKey: k2.publicKey, deviceName: "B" }, T0),
      ),
    ).toBe("INVITE_INVALID");
  });
  test("a code is valid for 48 h, not one millisecond more", async () => {
    const invite = await createInvite(sdb, { kind: "account", name: "Adam", createdBy: "admin" }, T0);
    const keys = await generateKeyPair();
    const late = T0 + SYNC_LIMITS.accountInviteMs + 1;
    expect(
      await code(
        redeemDeviceInvite(sdb, { code: invite.code, publicKey: keys.publicKey, deviceName: "A" }, late),
      ),
    ).toBe("INVITE_INVALID");
  });
  test("spaces, dashes and lowercase are accepted", async () => {
    const invite = await createInvite(sdb, { kind: "account", name: "Adam", createdBy: "admin" }, T0);
    const messy = ` ${invite.code.slice(0, 4).toLowerCase()}-${invite.code.slice(4, 13)} ${invite.code.slice(13)} `;
    const keys = await generateKeyPair();
    expect(
      await code(redeemDeviceInvite(sdb, { code: messy, publicKey: keys.publicKey, deviceName: "A" }, T0)),
    ).toBe("ok");
  });
  test("an invalid or small-order public key is refused and does not burn the code", async () => {
    const invite = await createInvite(sdb, { kind: "account", name: "Adam", createdBy: "admin" }, T0);
    for (const publicKey of ["AAAA", SMALL_ORDER_KEY, "not base64!"]) {
      expect(await code(redeemDeviceInvite(sdb, { code: invite.code, publicKey, deviceName: "A" }, T0))).toBe(
        "INVALID_INPUT",
      );
    }
    const keys = await generateKeyPair();
    expect(
      await code(
        redeemDeviceInvite(sdb, { code: invite.code, publicKey: keys.publicKey, deviceName: "A" }, T0),
      ),
    ).toBe("ok");
  });
  test("a public key already registered is refused and does not burn the code", async () => {
    const a = await account("Adam");
    const invite = await createInvite(sdb, { kind: "account", name: "Léa", createdBy: "admin" }, T0);
    expect(
      await code(
        redeemDeviceInvite(sdb, { code: invite.code, publicKey: a.keys.publicKey, deviceName: "A" }, T0),
      ),
    ).toBe("INVALID_INPUT");
    const keys = await generateKeyPair();
    expect(
      await code(
        redeemDeviceInvite(sdb, { code: invite.code, publicKey: keys.publicKey, deviceName: "A" }, T0),
      ),
    ).toBe("ok");
  });
  test("an unknown code is refused", async () => {
    const keys = await generateKeyPair();
    expect(
      await code(
        redeemDeviceInvite(sdb, { code: "A".repeat(26), publicKey: keys.publicKey, deviceName: "A" }, T0),
      ),
    ).toBe("INVITE_INVALID");
  });
  test("malformed invites are refused before anything is stored", async () => {
    const empty = createInvite(sdb, { kind: "account", name: "  ", createdBy: "admin" }, T0);
    expect(await code(empty)).toBe("INVALID_INPUT");
    const owner = await account("Adam");
    insertProject(sdb, { id: "p1", ownerId: owner.userId, name: "Kibo", ticketSeq: 0 }, T0);
    const asOwner = createInvite(
      sdb,
      JSON.parse(
        JSON.stringify({ kind: "project", projectId: "p1", role: "owner", createdBy: owner.userId }),
      ),
      T0,
    );
    expect(await code(asOwner)).toBe("INVALID_INPUT");
    expect(sdb.db.query("SELECT COUNT(*) AS n FROM invites").get()).toEqual({ n: 1 });
  });
});

describe("devices", () => {
  test("a device code adds a device to the same user for 15 minutes", async () => {
    const a = await account("Adam");
    const invite = await createInvite(sdb, { kind: "device", userId: a.userId, createdBy: a.userId }, T0);
    expect(invite.expiresAt).toBe(T0 + SYNC_LIMITS.deviceInviteMs);
    const keys = await generateKeyPair();
    const second = await redeemDeviceInvite(
      sdb,
      { code: invite.code, publicKey: keys.publicKey, deviceName: "iMac" },
      T0 + 60_000,
    );
    expect(second.userId).toBe(a.userId);
    expect(listDevices(sdb, a.userId).map((d) => d.name)).toEqual(["Mac de Adam", "iMac"]);
    const late = await createInvite(sdb, { kind: "device", userId: a.userId, createdBy: a.userId }, T0);
    const k3 = await generateKeyPair();
    const tooLate = T0 + SYNC_LIMITS.deviceInviteMs + 1;
    expect(
      await code(
        redeemDeviceInvite(sdb, { code: late.code, publicKey: k3.publicKey, deviceName: "X" }, tooLate),
      ),
    ).toBe("INVITE_INVALID");
  });
  test("a device code cannot join a project", async () => {
    const a = await account("Adam");
    const invite = await createInvite(sdb, { kind: "device", userId: a.userId, createdBy: a.userId }, T0);
    expect(await code(redeemProjectInvite(sdb, { code: invite.code, userId: a.userId }, T0))).toBe(
      "INVITE_INVALID",
    );
  });
  test("revoking marks the device and is audited", async () => {
    const a = await account("Adam");
    revokeDevice(sdb, { deviceId: a.deviceId, by: "admin" }, T0 + 5);
    expect(deviceRecord(sdb, a.deviceId)?.revoked).toBe(true);
    expect(listDevices(sdb, a.userId)[0]?.revokedAt).toBe(T0 + 5);
    expect(readAudit(sdb, 1)[0]?.kind).toBe("device-revoked");
    expect(() => revokeDevice(sdb, { deviceId: "nope", by: "admin" }, T0)).toThrow("NOT_FOUND");
  });
  test("disabling a user flags every device and stops pending device codes", async () => {
    const a = await account("Adam");
    const pending = await createInvite(sdb, { kind: "device", userId: a.userId, createdBy: a.userId }, T0);
    disableUser(sdb, a.userId, T0 + 5);
    expect(deviceRecord(sdb, a.deviceId)?.userDisabled).toBe(true);
    const invite = createInvite(sdb, { kind: "device", userId: a.userId, createdBy: "admin" }, T0);
    expect(await code(invite)).toBe("FORBIDDEN");
    const keys = await generateKeyPair();
    expect(
      await code(
        redeemDeviceInvite(sdb, { code: pending.code, publicKey: keys.publicKey, deviceName: "X" }, T0),
      ),
    ).toBe("INVITE_INVALID");
  });
});

describe("project invites and members", () => {
  test("a project invite adds the member with its role, once", async () => {
    const owner = await account("Adam");
    const lea = await account("Léa");
    insertProject(sdb, { id: "p1", ownerId: owner.userId, name: "Kibo", ticketSeq: 24 }, T0);
    const invite = await createInvite(
      sdb,
      { kind: "project", projectId: "p1", role: "viewer", createdBy: owner.userId },
      T0,
    );
    expect(invite.expiresAt).toBe(T0 + SYNC_LIMITS.projectInviteMs);
    expect(await redeemProjectInvite(sdb, { code: invite.code, userId: lea.userId }, T0)).toEqual({
      projectId: "p1",
      role: "viewer",
    });
    expect(roleOf(sdb, "p1", lea.userId)).toBe("viewer");
    expect(projectsOf(sdb, lea.userId)).toEqual([{ id: "p1", name: "Kibo", role: "viewer" }]);
    expect(await code(redeemProjectInvite(sdb, { code: invite.code, userId: lea.userId }, T0))).toBe(
      "INVITE_INVALID",
    );
  });
  test("an account code cannot be used as a project code", async () => {
    const owner = await account("Adam");
    insertProject(sdb, { id: "p1", ownerId: owner.userId, name: "Kibo", ticketSeq: 0 }, T0);
    const invite = await createInvite(sdb, { kind: "account", name: "X", createdBy: "admin" }, T0);
    expect(await code(redeemProjectInvite(sdb, { code: invite.code, userId: owner.userId }, T0))).toBe(
      "INVITE_INVALID",
    );
  });
  test("a project invite needs a shared project and an active user", async () => {
    const owner = await account("Adam");
    const lea = await account("Léa");
    expect(
      await code(
        createInvite(sdb, { kind: "project", projectId: "p9", role: "editor", createdBy: owner.userId }, T0),
      ),
    ).toBe("NOT_FOUND");
    insertProject(sdb, { id: "p1", ownerId: owner.userId, name: "Kibo", ticketSeq: 0 }, T0);
    const invite = await createInvite(
      sdb,
      { kind: "project", projectId: "p1", role: "editor", createdBy: owner.userId },
      T0,
    );
    disableUser(sdb, lea.userId, T0);
    expect(await code(redeemProjectInvite(sdb, { code: invite.code, userId: lea.userId }, T0))).toBe(
      "INVITE_INVALID",
    );
    sdb.db.query("DELETE FROM projects WHERE id = 'p1'").run();
    const bob = await account("Bob");
    expect(await code(redeemProjectInvite(sdb, { code: invite.code, userId: bob.userId }, T0))).toBe(
      "INVITE_INVALID",
    );
  });
  test("roles change, members are removed, the last owner stays", async () => {
    const owner = await account("Adam");
    const lea = await account("Léa");
    insertProject(sdb, { id: "p1", ownerId: owner.userId, name: "Kibo", ticketSeq: 0 }, T0);
    setRole(sdb, { projectId: "p1", userId: lea.userId, role: "editor" }, T0);
    expect(listMembers(sdb, "p1")).toEqual([
      { userId: owner.userId, name: "Adam", role: "owner" },
      { userId: lea.userId, name: "Léa", role: "editor" },
    ]);
    setRole(sdb, { projectId: "p1", userId: lea.userId, role: null }, T0);
    expect(roleOf(sdb, "p1", lea.userId)).toBeNull();
    expect(() => setRole(sdb, { projectId: "p1", userId: owner.userId, role: "editor" }, T0)).toThrow(
      "FORBIDDEN",
    );
    expect(() => setRole(sdb, { projectId: "p1", userId: owner.userId, role: null }, T0)).toThrow(
      "FORBIDDEN",
    );
    expect(() => setRole(sdb, { projectId: "p9", userId: lea.userId, role: "editor" }, T0)).toThrow(
      "NOT_FOUND",
    );
  });
});
