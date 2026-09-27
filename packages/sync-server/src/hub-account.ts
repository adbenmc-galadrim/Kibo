import { CLOSE_CODES, type ClientFrame, KiboError } from "@kibo/schema";
import { createInvite, deviceRecord, listDevices, redeemProjectInvite, revokeDevice } from "./accounts";
import type { ConnState, HubContext, Session } from "./hub-context";
import { OWNER, requireRole } from "./hub-projects";
import { projectsOf } from "./members";

export async function handleAccount(
  ctx: HubContext,
  state: ConnState,
  me: Session,
  frame: ClientFrame,
): Promise<void> {
  const { sdb, now } = ctx;
  if (frame.type === "invite") {
    requireRole(sdb, frame.projectId, me.userId, OWNER);
    const { projectId, role } = frame;
    const invite = await createInvite(sdb, { kind: "project", projectId, role, createdBy: me.userId }, now());
    state.conn.send({ type: "invite-code", requestId: frame.requestId, ...invite });
  } else if (frame.type === "redeem") {
    const joined = await redeemProjectInvite(sdb, { code: frame.code, userId: me.userId }, now());
    ctx.membersChanged(joined.projectId);
    const name = projectsOf(sdb, me.userId).find((p) => p.id === joined.projectId)?.name ?? joined.projectId;
    state.conn.send({
      type: "joined",
      requestId: frame.requestId,
      projectId: joined.projectId,
      name,
      role: joined.role,
    });
  } else if (frame.type === "device-invite") {
    const invite = await createInvite(
      sdb,
      { kind: "device", userId: me.userId, createdBy: me.userId },
      now(),
    );
    state.conn.send({ type: "invite-code", requestId: frame.requestId, ...invite });
  } else if (frame.type === "list-devices") {
    state.conn.send({ type: "devices", requestId: frame.requestId, devices: listDevices(sdb, me.userId) });
  } else if (frame.type === "revoke-device") {
    const target = deviceRecord(sdb, frame.deviceId);
    if (!target || target.userId !== me.userId) {
      throw new KiboError("FORBIDDEN", "you can only revoke your own devices");
    }
    revokeDevice(sdb, { deviceId: frame.deviceId, by: me.userId }, now());
    state.conn.send({ type: "done", requestId: frame.requestId });
    ctx.kickDevice(frame.deviceId, CLOSE_CODES.deviceRevoked);
  }
}
