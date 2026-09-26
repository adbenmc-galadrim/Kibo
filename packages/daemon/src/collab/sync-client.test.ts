import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getNode, getTicket, listTickets } from "@kibo/core";
import { KiboError, type RpcRequest, SYNC_LIMITS } from "@kibo/schema";
import { revokeDevice } from "@kibo/sync-server";
import { generateKeyPair } from "@kibo/trust";
import { z } from "zod";
import { call } from "../service";
import { type SyncHarness, startSyncHarness } from "../testing/sync-harness";
import { backoffDelay } from "./sync-client";

let h: SyncHarness;
beforeEach(async () => {
  h = await startSyncHarness({ daemons: 2 });
});
afterEach(async () => {
  await h.stop();
});

const d = (i: number) => {
  const x = h.daemons[i];
  if (!x) throw new Error("no daemon");
  return x;
};
const rpc = async (i: number, req: RpcRequest) => d(i).service.handle(req);
async function newProject(i: number, key = "KIB"): Promise<string> {
  const req = { method: "createProject", name: "Kibo", key, folder: null, color: "#14B8A6" } as const;
  return call(d(i).service, req).id;
}
const titles = (i: number, projectId: string) =>
  listTickets(d(i).hosts.host(projectId).doc()).map((t) => t.title);
const projectStatus = (i: number, projectId: string) =>
  d(i)
    .client.status()
    .projects.find((x) => x.projectId === projectId);

test("backoff grows from 1 s to 60 s with jitter", () => {
  const limits = { minMs: SYNC_LIMITS.backoffMinMs, maxMs: SYNC_LIMITS.backoffMaxMs };
  expect(backoffDelay(0, 0.7, limits)).toBe(1000);
  expect(backoffDelay(3, 0, limits)).toBe(1000);
  expect(backoffDelay(3, 1, limits)).toBe(8000);
  expect(backoffDelay(3, 0.5, limits)).toBe(4500);
  expect(backoffDelay(20, 1, limits)).toBe(60_000);
});

describe("device authentication", () => {
  test("connects with an account code and stores the key only in the secret store", async () => {
    await h.connect(0, "Adam");
    const status = d(0).client.status();
    expect(status.state).toBe("online");
    expect(status.user?.name).toBe("Adam");
    const stored = await d(0).secrets.get("sync:device");
    const keys = z.object({ privateKey: z.string() }).parse(JSON.parse(stored ?? "{}"));
    expect(keys.privateKey.length).toBeGreaterThan(0);
    const db = readFileSync(join(d(0).home, "kibo.db"));
    expect(db.includes(Buffer.from(keys.privateKey))).toBe(false);
    expect(db.includes(Buffer.from(keys.privateKey, "base64"))).toBe(false);
  });

  test("a wrong account code leaves nothing configured", async () => {
    const attempt = d(0).client.connect({
      serverUrl: h.server.url,
      code: "AAAAAAAAAAAAAAAAAAAAAAAAAA",
      deviceName: "Adam",
      caFile: h.caFile,
    });
    await expect(attempt).rejects.toMatchObject({ code: "INVITE_INVALID" });
    expect(d(0).client.status().state).toBe("unconfigured");
    expect(await d(0).secrets.get("sync:device")).toBeNull();
  });

  test("a device holding another key is refused and retries slowly", async () => {
    await h.connect(0, "Adam");
    d(0).client.stop();
    await d(0).secrets.set("sync:device", JSON.stringify(await generateKeyPair()));
    const opensBefore = d(0).opens();
    await d(0).client.start();
    await h.waitUntil(() => d(0).client.status().lastError !== null);
    const status = d(0).client.status();
    expect(status.state).toBe("offline");
    expect(status.lastError).toBe("UNAUTHORIZED");
    expect((status.retryAt ?? 0) - Date.now()).toBeGreaterThan(100);
    await Bun.sleep(300);
    expect(d(0).opens() - opensBefore).toBeLessThanOrEqual(2);
  });

  test("refuses an unencrypted server outside loopback", async () => {
    const attempt = d(0).client.connect({
      serverUrl: "ws://10.0.0.2:4000",
      code: "X",
      deviceName: "Adam",
      caFile: null,
    });
    await expect(attempt).rejects.toMatchObject({ code: "TLS_REQUIRED" });
  });

  test("a revoked device is closed with 4403 and does not retry", async () => {
    await h.connect(0, "Adam");
    const deviceId = d(0).client.status().deviceId ?? "";
    revokeDevice(h.server.server.sdb, { deviceId, by: "admin" }, Date.now());
    h.server.server.hub.kickDevice(deviceId, 4403);
    await h.waitUntil(() => d(0).client.status().lastError === "DEVICE_REVOKED");
    await Bun.sleep(500);
    expect(d(0).opens()).toBe(1);
    expect(d(0).client.status().retryAt).toBeNull();
  });

  test("devices are listed, invited and revoked through the connection", async () => {
    await h.connect(0, "Adam");
    const devices = await d(0).client.listDevices();
    expect(devices.map((x) => x.name)).toEqual(["Adam"]);
    const invite = await d(0).client.addDevice();
    expect(invite.code.length).toBeGreaterThan(0);
    expect(invite.expiresAt).toBeGreaterThan(Date.now());
    await expect(d(0).client.revokeDevice("unknown-device")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("disconnecting forgets the key and marks shared projects as revoked", async () => {
    await h.connect(0, "Adam");
    const p = await newProject(0);
    await h.shareRaw(0, p);
    await d(0).client.disconnect();
    expect(await d(0).secrets.get("sync:device")).toBeNull();
    expect(d(0).client.status().state).toBe("unconfigured");
    expect(projectStatus(0, p)).toMatchObject({ accessRevoked: true, lastError: "NOT_CONNECTED" });
    const attempt = rpc(0, {
      method: "command",
      projectId: p,
      command: { method: "createTicket", title: "Non" },
    });
    await expect(attempt).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("replication", () => {
  test("changes made offline are pushed when the server comes back", async () => {
    await h.connect(0, "Adam");
    const p = await newProject(0);
    await h.shareRaw(0, p);
    await h.stopServer();
    await h.waitUntil(() => d(0).client.status().state !== "online");
    const create = { method: "createTicket", title: "Hors ligne" } as const;
    await rpc(0, { method: "command", projectId: p, command: create });
    await h.startServer();
    await h.waitUntil(() => d(0).client.status().state === "online", 10_000);
    await h.waitUntil(() => getTicketKeys(0, p).includes("KIB-1"), 10_000);
    await h.connect(1, "Léa");
    await h.joinRaw(1, await h.inviteRaw(0, p, "editor"));
    await h.waitUntil(() => titles(1, p).includes("Hors ligne"), 10_000);
  }, 30_000);

  test("edits flow both ways between two members", async () => {
    await h.connect(0, "Adam");
    await h.connect(1, "Léa");
    const p = await newProject(0);
    await h.shareRaw(0, p);
    await h.joinRaw(1, await h.inviteRaw(0, p, "editor"));
    await rpc(1, { method: "command", projectId: p, command: { method: "createTicket", title: "De Léa" } });
    await h.waitUntil(() => titles(0, p).includes("De Léa"));
    await rpc(0, { method: "command", projectId: p, command: { method: "createTicket", title: "D'Adam" } });
    await h.waitUntil(() => titles(1, p).includes("D'Adam"));
    await h.waitUntil(() => getTicketKeys(1, p).length === 2 && getTicketKeys(0, p).length === 2);
    expect(getTicketKeys(0, p).sort()).toEqual(getTicketKeys(1, p).sort());
    const info = call(d(1).service, { method: "getProject", projectId: p });
    expect(info.sync).toMatchObject({ shared: true, role: "editor", access: "write" });
  });

  test("UPDATE_REJECTED replaces the local doc and reports the lost changes", async () => {
    await h.connect(0, "Adam");
    const p = await newProject(0);
    await rpc(0, { method: "command", projectId: p, command: { method: "createTicket", title: "Original" } });
    await h.shareRaw(0, p);
    const doc = d(0).hosts.host(p).doc();
    const ticket = listTickets(doc)[0];
    if (!ticket) throw new Error("no ticket");
    const before = d(0).events.length;
    d(0).hosts.mutate(p, (x) => {
      getNode(x.getTree("tickets"), ticket.id).data.set("key", "KIB-999");
    });
    const update = { method: "updateTicket", ticketId: ticket.id, title: "Perdu" } as const;
    await rpc(0, { method: "command", projectId: p, command: update });
    await h.waitUntil(() => d(0).hosts.host(p).doc() !== doc, 10_000);
    const replaced = getTicket(d(0).hosts.host(p).doc(), ticket.id);
    expect(replaced).toMatchObject({ key: "KIB-1", title: "Original" });
    expect(projectStatus(0, p)?.lastError).toBe("UPDATE_REJECTED");
    expect(d(0).events.slice(before)).toContainEqual({ type: "collab.changed" });
    await Bun.sleep(200);
    expect(projectStatus(0, p)?.lastError).toBe("UPDATE_REJECTED");
    await rpc(0, { method: "command", projectId: p, command: { method: "createTicket", title: "Ensuite" } });
    await h.waitUntil(() => projectStatus(0, p)?.lastError === null);
  });
});

describe("roles", () => {
  test("a viewer is read-only, online and offline", async () => {
    await h.connect(0, "Adam");
    await h.connect(1, "Léa");
    const p = await newProject(0);
    await h.shareRaw(0, p);
    await h.joinRaw(1, await h.inviteRaw(0, p, "viewer"));
    const create = { method: "createTicket", title: "Non" } as const;
    const attempt = () => rpc(1, { method: "command", projectId: p, command: create });
    await expect(attempt()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await h.stopServer();
    await h.waitUntil(() => d(1).client.status().state !== "online");
    await expect(attempt()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("a member removed while offline ends up revoked without pushing", async () => {
    await h.connect(0, "Adam");
    await h.connect(1, "Léa");
    const p = await newProject(0);
    await h.shareRaw(0, p);
    await h.joinRaw(1, await h.inviteRaw(0, p, "editor"));
    const leaId = d(1).client.status().user?.id ?? "";
    d(1).client.stop();
    const remove = { type: "set-role", projectId: p, requestId: "r1", userId: leaId, role: null } as const;
    await d(0).client.request(remove, "done");
    await rpc(1, {
      method: "command",
      projectId: p,
      command: { method: "createTicket", title: "Jamais envoyé" },
    });
    await d(1).client.start();
    await h.waitUntil(() => projectStatus(1, p)?.accessRevoked === true);
    const create = { method: "createTicket", title: "Non" } as const;
    await expect(rpc(1, { method: "command", projectId: p, command: create })).rejects.toBeInstanceOf(
      KiboError,
    );
    await Bun.sleep(300);
    expect(titles(0, p)).not.toContain("Jamais envoyé");
    expect(titles(1, p)).toContain("Jamais envoyé");
  });

  test("a member removed while online is revoked at once", async () => {
    await h.connect(0, "Adam");
    await h.connect(1, "Léa");
    const p = await newProject(0);
    await h.shareRaw(0, p);
    await h.joinRaw(1, await h.inviteRaw(0, p, "editor"));
    const leaId = d(1).client.status().user?.id ?? "";
    const remove = { type: "set-role", projectId: p, requestId: "r2", userId: leaId, role: null } as const;
    await d(0).client.request(remove, "done");
    await h.waitUntil(() => projectStatus(1, p)?.accessRevoked === true);
    expect(projectStatus(1, p)?.lastError).toBe("ACCESS_REVOKED");
  });
});

function getTicketKeys(i: number, projectId: string): string[] {
  return listTickets(d(i).hosts.host(projectId).doc()).flatMap((t) => (t.key === null ? [] : [t.key]));
}
