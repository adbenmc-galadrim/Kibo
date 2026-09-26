import {
  CLOSE_CODES,
  type ClientFrame,
  KiboError,
  type KiboErrorCode,
  parseClientFrame,
  type ServerFrame,
  SYNC_LIMITS,
} from "@kibo/schema";
import { toBase64 } from "@kibo/trust";
import { createInvite, deviceRecord, listDevices, redeemProjectInvite, revokeDevice } from "./accounts";
import { audit } from "./audit";
import { ChallengeNonces, verifyChallenge } from "./auth";
import type { ServerDb } from "./db";
import type { ConnState, HubConnection, HubContext, Session } from "./hub-context";
import { changeRole, OWNER, presence, push, requireRole, share, subscribe, unshare } from "./hub-projects";
import { FailureLimiter, RateWindow } from "./limits";
import { listMembers, projectsOf } from "./members";
import { publicErrorMessage } from "./public-error";
import type { RoomRegistry } from "./rooms";

export type { HubConnection } from "./hub-context";

type HubOptions = { sdb: ServerDb; rooms: RoomRegistry; origin: string; now: () => number };

export class SyncHub {
  readonly failures: FailureLimiter;
  readonly challenges: ChallengeNonces;
  private readonly conns = new Map<string, ConnState>();
  private readonly ctx: HubContext;

  constructor(private readonly opts: HubOptions) {
    this.failures = new FailureLimiter({
      max: SYNC_LIMITS.authFailuresPerMinute,
      windowMs: 60_000,
      blockMs: SYNC_LIMITS.authBlockMs,
      now: opts.now,
    });
    this.challenges = new ChallengeNonces({ now: opts.now });
    this.ctx = {
      sdb: opts.sdb,
      rooms: opts.rooms,
      now: opts.now,
      pushes: new RateWindow({ limit: SYNC_LIMITS.updatesPerSecond, windowMs: 1000, now: opts.now }),
      connections: () => this.conns.values(),
      broadcast: (projectId, frame, exceptConnId) => this.broadcast(projectId, frame, exceptConnId),
      leave: (state, projectId) => this.leave(state, projectId),
      membersChanged: (projectId) => this.membersChanged(projectId),
    };
  }

  open(conn: HubConnection): void {
    const nonce = this.challenges.issue();
    this.conns.set(conn.id, { conn, nonce, session: null, projects: new Set(), queue: Promise.resolve() });
    conn.send({ type: "challenge", nonce });
  }

  message(conn: HubConnection, raw: string): Promise<void> {
    const state = this.conns.get(conn.id);
    if (!state) return Promise.resolve();
    state.queue = state.queue.then(() => this.handle(state, raw));
    return state.queue;
  }

  closed(conn: HubConnection): void {
    const state = this.conns.get(conn.id);
    if (!state) return;
    if (!state.session) this.challenges.consume(state.nonce);
    for (const projectId of state.projects) this.opts.rooms.detach(projectId, conn.id);
    this.conns.delete(conn.id);
  }

  kickDevice(deviceId: string, code: number): void {
    for (const s of this.conns.values()) {
      if (s.session?.deviceId === deviceId) s.conn.close(code, "device revoked");
    }
  }

  checkRevocations(): void {
    for (const s of this.conns.values()) {
      if (s.session && !this.deviceActive(s.session.deviceId)) {
        s.conn.close(CLOSE_CODES.deviceRevoked, "device revoked");
      }
    }
  }

  private deviceActive(deviceId: string): boolean {
    const device = deviceRecord(this.opts.sdb, deviceId);
    return device !== null && !device.revoked && !device.userDisabled;
  }

  private async handle(state: ConnState, raw: string): Promise<void> {
    let frame: ClientFrame;
    try {
      frame = parseClientFrame(raw);
    } catch (e) {
      if (!(e instanceof KiboError)) throw e;
      this.error(state, null, e.code);
      return;
    }
    const requestId = "requestId" in frame ? frame.requestId : null;
    try {
      await this.route(state, frame);
    } catch (e) {
      if (e instanceof KiboError) {
        this.error(state, requestId, e.code);
        return;
      }
      console.error("[kibo-sync] frame failed", frame.type, e);
      this.error(state, requestId, "INTERNAL");
    }
  }

  private async route(state: ConnState, frame: ClientFrame): Promise<void> {
    const session = state.session;
    if (!session) {
      if (frame.type === "auth") await this.auth(state, frame);
      else state.conn.close(CLOSE_CODES.authFailed, "authenticate first");
      return;
    }
    if (!this.deviceActive(session.deviceId)) {
      state.conn.close(CLOSE_CODES.deviceRevoked, "device revoked");
      return;
    }
    await this.dispatch(state, session, frame);
  }

  private async auth(state: ConnState, frame: Extract<ClientFrame, { type: "auth" }>): Promise<void> {
    const { sdb, now, origin } = this.opts;
    const ip = state.conn.ip;
    const fresh = this.challenges.consume(state.nonce);
    if (!fresh || this.failures.blocked(ip)) {
      state.conn.close(CLOSE_CODES.authFailed, fresh ? "too many failures" : "challenge expired");
      return;
    }
    let who: Session;
    try {
      const input = { deviceId: frame.deviceId, signature: frame.signature, nonce: state.nonce, origin };
      who = await verifyChallenge(sdb, input, now());
    } catch (e) {
      if (!(e instanceof KiboError)) throw e;
      if (e.code !== "DEVICE_REVOKED") this.failures.fail(ip);
      audit(sdb, {
        at: now(),
        kind: "auth-failed",
        deviceId: frame.deviceId,
        detail: `${e.code} from ${ip}`,
      });
      state.conn.close(
        e.code === "DEVICE_REVOKED" ? CLOSE_CODES.deviceRevoked : CLOSE_CODES.authFailed,
        e.code,
      );
      return;
    }
    const open = [...this.conns.values()].filter((s) => s.session?.userId === who.userId).length;
    if (open >= SYNC_LIMITS.connectionsPerUser) {
      state.conn.close(CLOSE_CODES.tooManyConnections, "too many connections");
      return;
    }
    state.session = who;
    audit(sdb, { at: now(), kind: "connect", userId: who.userId, deviceId: who.deviceId, detail: ip });
    const projects = projectsOf(sdb, who.userId);
    state.conn.send({
      type: "welcome",
      userId: who.userId,
      name: who.name,
      deviceId: who.deviceId,
      projects,
    });
  }

  private async dispatch(state: ConnState, me: Session, frame: ClientFrame): Promise<void> {
    switch (frame.type) {
      case "auth":
        throw new KiboError("INVALID_INPUT", "already authenticated");
      case "subscribe":
        subscribe(this.ctx, state, me, frame);
        return;
      case "unsubscribe":
        this.leave(state, frame.projectId);
        return;
      case "push":
        push(this.ctx, state, me, frame);
        return;
      case "presence":
        presence(this.ctx, state, me, frame);
        return;
      case "share":
        share(this.ctx, state, me, frame);
        return;
      case "set-role":
        changeRole(this.ctx, state, me, frame);
        return;
      case "unshare":
        unshare(this.ctx, state, me, frame);
        return;
      default:
        await this.account(state, me, frame);
    }
  }

  private async account(state: ConnState, me: Session, frame: ClientFrame): Promise<void> {
    const { sdb, now } = this.opts;
    if (frame.type === "invite") {
      requireRole(sdb, frame.projectId, me.userId, OWNER);
      const { projectId, role } = frame;
      const invite = await createInvite(
        sdb,
        { kind: "project", projectId, role, createdBy: me.userId },
        now(),
      );
      state.conn.send({ type: "invite-code", requestId: frame.requestId, ...invite });
    } else if (frame.type === "redeem") {
      const joined = await redeemProjectInvite(sdb, { code: frame.code, userId: me.userId }, now());
      this.membersChanged(joined.projectId);
      const name =
        projectsOf(sdb, me.userId).find((p) => p.id === joined.projectId)?.name ?? joined.projectId;
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
      this.kickDevice(frame.deviceId, CLOSE_CODES.deviceRevoked);
    }
  }

  private membersChanged(projectId: string): void {
    const { rooms, sdb, now } = this.opts;
    const res = rooms.get(projectId).syncMembers(now());
    if (res?.bytes) {
      const { serverSeq } = res;
      const version = toBase64(res.version);
      this.broadcast(projectId, {
        type: "update",
        projectId,
        bytes: toBase64(res.bytes),
        serverSeq,
        version,
      });
    }
    this.broadcast(projectId, { type: "members", projectId, members: listMembers(sdb, projectId) });
  }

  private leave(state: ConnState, projectId: string): void {
    if (!state.projects.delete(projectId)) return;
    this.opts.rooms.detach(projectId, state.conn.id);
  }

  private broadcast(projectId: string, frame: ServerFrame, exceptConnId?: string): void {
    for (const s of this.conns.values()) {
      if (s.projects.has(projectId) && s.conn.id !== exceptConnId) s.conn.send(frame);
    }
  }

  private error(state: ConnState, requestId: string | null, code: KiboErrorCode): void {
    state.conn.send({ type: "error", requestId, code, message: publicErrorMessage(code) });
  }
}
