import { type ClientFrame, KiboError, type MemberRole, type RejectCode } from "@kibo/schema";
import { fromBase64, toBase64 } from "@kibo/trust";
import { audit } from "./audit";
import type { ServerDb } from "./db";
import type { ConnState, HubContext, Session } from "./hub-context";
import { deleteProject, listMembers, projectOwner, roleOf, setRole } from "./members";
import { ownPresence } from "./presence-guard";
import { publicRejectMessage } from "./public-error";
import { RoomReject } from "./room";

type Frame<T extends ClientFrame["type"]> = Extract<ClientFrame, { type: T }>;

const WRITERS: readonly MemberRole[] = ["owner", "editor"];
export const ANY_MEMBER: readonly MemberRole[] = ["owner", "editor", "viewer"];
export const OWNER: readonly MemberRole[] = ["owner"];

export function requireRole(
  sdb: ServerDb,
  projectId: string,
  userId: string,
  allowed: readonly MemberRole[],
): MemberRole {
  const role = roleOf(sdb, projectId, userId);
  if (!role || !allowed.includes(role))
    throw new KiboError("FORBIDDEN", `${allowed.join(" or ")} role required`);
  return role;
}

export function subscribe(ctx: HubContext, state: ConnState, me: Session, frame: Frame<"subscribe">): void {
  const { projectId } = frame;
  requireRole(ctx.sdb, projectId, me.userId, ANY_MEMBER);
  const room = ctx.rooms.get(projectId);
  const bytes = room.diffSince(frame.version === null ? null : fromBase64(frame.version));
  if (!state.projects.has(projectId)) {
    ctx.rooms.attach(projectId, state.conn.id);
    state.projects.add(projectId);
  }
  const version = toBase64(room.version());
  state.conn.send({
    type: "update",
    projectId,
    bytes: toBase64(bytes),
    serverSeq: room.serverSeq(),
    version,
  });
  state.conn.send({ type: "members", projectId, members: listMembers(ctx.sdb, projectId) });
  if (room.presence.keys().length > 0) {
    state.conn.send({ type: "presence", projectId, bytes: toBase64(room.presence.encodeAll()) });
  }
}

export function push(ctx: HubContext, state: ConnState, me: Session, frame: Frame<"push">): void {
  const { projectId, clientBatchId } = frame;
  const reject = (code: RejectCode, version: Uint8Array | null): void => {
    const encoded = version === null ? null : toBase64(version);
    const message = publicRejectMessage(code);
    state.conn.send({ type: "reject", projectId, clientBatchId, code, message, version: encoded });
  };
  const role = roleOf(ctx.sdb, projectId, me.userId);
  if (!state.projects.has(projectId) || role === null || !WRITERS.includes(role)) {
    reject("FORBIDDEN", null);
    return;
  }
  if (!ctx.pushes.take(me.deviceId)) {
    reject("RATE_LIMITED", null);
    return;
  }
  const room = ctx.rooms.get(projectId);
  let result: ReturnType<typeof room.push>;
  try {
    result = room.push(
      fromBase64(frame.bytes),
      { userId: me.userId, deviceId: me.deviceId, role },
      ctx.now(),
    );
  } catch (e) {
    if (!(e instanceof RoomReject)) throw e;
    reject(e.code, e.version);
    return;
  }
  const { serverSeq } = result;
  const version = toBase64(result.version);
  state.conn.send({ type: "ack", projectId, clientBatchId, serverSeq, version });
  if (result.bytes) {
    ctx.broadcast(projectId, {
      type: "update",
      projectId,
      bytes: toBase64(result.bytes),
      serverSeq,
      version,
    });
  }
}

export function presence(ctx: HubContext, state: ConnState, me: Session, frame: Frame<"presence">): void {
  const { projectId } = frame;
  if (!state.projects.has(projectId)) throw new KiboError("FORBIDDEN", "subscribe before sending presence");
  if (!ctx.presences.take(me.deviceId)) throw new KiboError("RATE_LIMITED", "too many presence frames");
  const own = ownPresence(fromBase64(frame.bytes), me);
  if (!own) {
    const detail = "spoofed presence";
    audit(ctx.sdb, {
      at: ctx.now(),
      kind: "update-rejected",
      userId: me.userId,
      deviceId: me.deviceId,
      projectId,
      detail,
    });
    return;
  }
  const store = ctx.rooms.get(projectId).presence;
  store.set(me.deviceId, own);
  const bytes = toBase64(store.encode(me.deviceId));
  ctx.broadcast(projectId, { type: "presence", projectId, bytes }, state.conn.id);
}

export function share(ctx: HubContext, state: ConnState, me: Session, frame: Frame<"share">): void {
  const { projectId } = frame;
  const owner = projectOwner(ctx.sdb, projectId);
  if (owner !== null && owner !== me.userId) {
    throw new KiboError("FORBIDDEN", "this project id is shared by someone else");
  }
  const input = { projectId, name: frame.name, ownerId: me.userId, ownerName: me.name };
  if (owner === null) {
    ctx.rooms.create({ ...input, snapshot: fromBase64(frame.snapshot) });
  } else {
    if (listMembers(ctx.sdb, projectId).length > 1) {
      throw new KiboError("CONFLICT", `project ${projectId} already has members, its snapshot is final`);
    }
    ctx.rooms.replaceUnused({ ...input, snapshot: fromBase64(frame.snapshot) });
  }
  audit(ctx.sdb, { at: ctx.now(), kind: "project-shared", userId: me.userId, projectId });
  state.conn.send({ type: "shared", requestId: frame.requestId, projectId });
}

export function changeRole(ctx: HubContext, state: ConnState, me: Session, frame: Frame<"set-role">): void {
  const { projectId, userId, role } = frame;
  requireRole(ctx.sdb, projectId, me.userId, OWNER);
  setRole(ctx.sdb, { projectId, userId, role }, ctx.now());
  if (role === null) {
    for (const other of ctx.connections()) {
      if (other.session?.userId !== userId || !other.projects.has(projectId)) continue;
      other.conn.send({ type: "revoked", projectId, reason: "removed" });
      ctx.leave(other, projectId);
    }
  }
  ctx.membersChanged(projectId);
  state.conn.send({ type: "done", requestId: frame.requestId });
}

export function unshare(ctx: HubContext, state: ConnState, me: Session, frame: Frame<"unshare">): void {
  const { projectId } = frame;
  requireRole(ctx.sdb, projectId, me.userId, OWNER);
  deleteProject(ctx.sdb, { projectId, by: me.userId }, ctx.now());
  ctx.rooms.drop(projectId);
  for (const other of ctx.connections()) {
    if (!other.projects.has(projectId)) continue;
    if (other !== state) other.conn.send({ type: "revoked", projectId, reason: "deleted" });
    ctx.leave(other, projectId);
  }
  state.conn.send({ type: "done", requestId: frame.requestId });
}

export function withdrawPresence(ctx: HubContext, state: ConnState, projectId: string): void {
  const deviceId = state.session?.deviceId;
  const room = ctx.rooms.peek(projectId);
  if (!deviceId || !room || room.presence.get(deviceId) === undefined) return;
  for (const s of ctx.connections()) {
    if (s !== state && s.session?.deviceId === deviceId && s.projects.has(projectId)) return;
  }
  room.presence.delete(deviceId);
  const bytes = toBase64(room.presence.encode(deviceId));
  ctx.broadcast(projectId, { type: "presence", projectId, bytes }, state.conn.id);
}
