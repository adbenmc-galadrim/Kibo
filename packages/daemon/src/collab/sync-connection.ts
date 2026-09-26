import {
  type ChangeMessage,
  CLOSE_CODES,
  type ClientFrame,
  challengePayload,
  encodeFrame,
  KiboError,
  parseServerFrame,
  type ServerFrame,
  type SyncConnectionState,
} from "@kibo/schema";
import { signBytes } from "@kibo/trust";
import type { SecretStore } from "../integrations/types";
import { loadDeviceKeys } from "./device-keys";
import type { SyncDb } from "./sync-db";
import type { Timer } from "./sync-requests";
import type { SyncSocket, SyncTransport } from "./transport";

export type Limits = { minMs: number; maxMs: number };
export type ConnectionDeps = {
  db: SyncDb;
  secrets: SecretStore;
  transport: SyncTransport;
  readFile(path: string): Promise<string>;
  now(): number;
  random(): number;
  setTimer: Timer;
  emit(message: ChangeMessage): void;
  log(message: string, error?: unknown): void;
};
export type ConnectionEvents = {
  frame(frame: ServerFrame): Promise<void> | void;
  dropped(error: KiboError): void;
};
type WelcomeWaiter = { resolve(): void; reject(error: KiboError): void };

const NORMAL_CLOSE = 1000;

export function backoffDelay(attempt: number, random: number, limits: Limits): number {
  const base = Math.min(limits.maxMs, limits.minMs * 2 ** attempt);
  return Math.round(limits.minMs + random * (base - limits.minMs));
}

const asKiboError = (e: unknown): KiboError =>
  e instanceof KiboError ? e : new KiboError("SYNC_OFFLINE", String(e));

export class SyncConnection {
  state: SyncConnectionState = "offline";
  lastError: string | null = null;
  retryAt: number | null = null;
  private socket: SyncSocket | null = null;
  private attempt = 0;
  private cancelRetry: (() => void) | null = null;
  private halted = false;
  private stopped = true;
  private inbox: Promise<void> = Promise.resolve();
  private readonly welcomeWaiters = new Set<WelcomeWaiter>();

  constructor(
    private readonly deps: ConnectionDeps,
    private readonly limits: Limits,
    private readonly events: ConnectionEvents,
  ) {}

  start(): void {
    this.stopped = false;
    this.halted = false;
    if (this.deps.db.config()) this.launch();
  }

  stop(): void {
    this.stopped = true;
    this.clearRetry();
    const socket = this.socket;
    this.socket = null;
    socket?.close(NORMAL_CLOSE);
    this.drop(new KiboError("SYNC_OFFLINE", "sync client stopped"));
  }

  reset(): void {
    this.lastError = null;
    this.attempt = 0;
  }

  waitOnline(): Promise<void> {
    return new Promise((resolve, reject) => this.welcomeWaiters.add({ resolve, reject }));
  }

  send(frame: ClientFrame): void {
    if (!this.socket || this.state !== "online") {
      throw new KiboError("SYNC_OFFLINE", "not connected to the sync server");
    }
    this.socket.send(encodeFrame(frame));
  }

  private launch(): void {
    this.open().catch((e: unknown) => {
      this.deps.log("sync connection failed to open", e);
      this.socket = null;
      this.lastError = asKiboError(e).code;
      this.drop(asKiboError(e));
      this.retry(backoffDelay(this.attempt, this.deps.random(), this.limits));
      this.deps.emit({ type: "collab.changed" });
    });
  }

  private async open(): Promise<void> {
    const config = this.deps.db.config();
    if (!config || this.stopped || this.halted) return;
    this.state = "connecting";
    this.retryAt = null;
    this.deps.emit({ type: "collab.changed" });
    const ca = config.caFile ? await this.deps.readFile(config.caFile) : null;
    if (this.stopped) return;
    const socket = this.deps.transport.open(`${config.serverUrl}/v1/sync`, { ca });
    this.socket = socket;
    socket.onMessage((text) => {
      if (this.socket !== socket) return;
      this.inbox = this.inbox
        .then(() => this.receive(socket, text))
        .catch((e: unknown) => this.deps.log("sync frame handling failed", e));
    });
    socket.onClose((code) => {
      if (this.socket === socket) this.closed(code);
    });
  }

  private async receive(socket: SyncSocket, text: string): Promise<void> {
    if (this.socket !== socket) return;
    let frame: ServerFrame;
    try {
      frame = parseServerFrame(text);
    } catch (e) {
      this.deps.log("invalid frame from the sync server", e);
      return;
    }
    if (frame.type === "challenge") {
      await this.authenticate(socket, frame.nonce);
      return;
    }
    if (frame.type === "welcome") {
      this.state = "online";
      this.attempt = 0;
      this.lastError = null;
    }
    await this.events.frame(frame);
    if (frame.type === "welcome") this.settleWelcome(null);
  }

  private async authenticate(socket: SyncSocket, nonce: string): Promise<void> {
    const config = this.deps.db.config();
    try {
      if (!config) throw new KiboError("INTERNAL", "challenge received without a sync configuration");
      const keys = await loadDeviceKeys(this.deps.secrets);
      const origin = new URL(config.serverUrl).origin;
      const signature = await signBytes(keys.privateKey, challengePayload(nonce, origin));
      socket.send(encodeFrame({ type: "auth", deviceId: config.deviceId, signature }));
    } catch (e) {
      this.deps.log("sync authentication could not be prepared", e);
      this.lastError = asKiboError(e).code;
      socket.close(NORMAL_CLOSE);
    }
  }

  private closed(code: number): void {
    this.socket = null;
    if (code === CLOSE_CODES.deviceRevoked) {
      this.halted = true;
      this.lastError = "DEVICE_REVOKED";
      this.drop(new KiboError("DEVICE_REVOKED", "this device was revoked by the sync server"));
    } else if (code === CLOSE_CODES.authFailed) {
      this.lastError = "UNAUTHORIZED";
      this.drop(new KiboError("UNAUTHORIZED", "the sync server refused this device"));
      this.retry(this.limits.maxMs);
    } else {
      this.drop(new KiboError("SYNC_OFFLINE", `sync connection closed (${code})`));
      this.retry(backoffDelay(this.attempt, this.deps.random(), this.limits));
    }
    this.deps.emit({ type: "collab.changed" });
  }

  private drop(error: KiboError): void {
    this.state = "offline";
    this.events.dropped(error);
    this.settleWelcome(error);
  }

  private retry(delay: number): void {
    if (this.stopped || this.halted) return;
    this.clearRetry();
    this.attempt += 1;
    this.retryAt = this.deps.now() + delay;
    this.cancelRetry = this.deps.setTimer(() => {
      this.cancelRetry = null;
      this.retryAt = null;
      this.launch();
    }, delay);
  }

  private clearRetry(): void {
    this.cancelRetry?.();
    this.cancelRetry = null;
    this.retryAt = null;
  }

  private settleWelcome(error: KiboError | null): void {
    for (const waiter of this.welcomeWaiters) {
      if (error) waiter.reject(error);
      else waiter.resolve();
    }
    this.welcomeWaiters.clear();
  }
}
