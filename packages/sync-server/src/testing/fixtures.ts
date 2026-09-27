import { createProjectDoc, createTicket, migrateForSharing } from "@kibo/core";
import { generateKeyPair } from "@kibo/trust";
import { createInvite, redeemDeviceInvite, redeemProjectInvite } from "../accounts";
import type { ServerDb } from "../db";

export type SeededUser = { userId: string; deviceId: string; name: string };

export async function seedUser(sdb: ServerDb, name: string, now: number): Promise<SeededUser> {
  const invite = await createInvite(sdb, { kind: "account", name, createdBy: "admin" }, now);
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(
    sdb,
    { code: invite.code, publicKey: keys.publicKey, deviceName: `Appareil de ${name}` },
    now,
  );
  return { userId: joined.userId, deviceId: joined.deviceId, name: joined.name };
}

export async function addMember(
  sdb: ServerDb,
  input: { projectId: string; user: SeededUser; role: "editor" | "viewer"; owner: SeededUser },
  now: number,
): Promise<void> {
  const invite = await createInvite(
    sdb,
    { kind: "project", projectId: input.projectId, role: input.role, createdBy: input.owner.userId },
    now,
  );
  await redeemProjectInvite(sdb, { code: invite.code, userId: input.user.userId }, now);
}

export function ownerSnapshot(projectId = "p1"): Uint8Array {
  const doc = createProjectDoc({ id: projectId, key: "KIB", name: "Kibo", folder: null, color: "#F97316" });
  createTicket(doc, { title: "Noyau de données" });
  createTicket(doc, { title: "Schéma Loro des tickets" });
  migrateForSharing(doc, { localUser: "adam", userId: "u-adam", domains: [] });
  return doc.export({ mode: "snapshot" });
}
