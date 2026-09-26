import { Base64, KiboError, SyncId } from "@kibo/schema";
import { HTTP_SIGNATURE_HEADERS, httpSigningPayload, sha256Hex, verifyBytes } from "@kibo/trust";
import { z } from "zod";
import { type DeviceRecord, deviceRecord, touchDevice } from "../accounts";
import type { ServerDb } from "../db";

export const SIGNED_REQUEST_SKEW_MS = 300_000;
export const NONCE_TTL_MS = 600_000;
const NONCE_SWEEP_MS = 60_000;
const CONTROL = /\p{Cc}/u;

const SignatureHeaders = z.object({
  deviceId: SyncId,
  date: z.string().regex(/^\d{1,15}$/),
  nonce: z.string().min(16).max(128).pipe(Base64),
  signature: z.string().min(1).max(128).pipe(Base64),
});
type SignatureHeaders = z.infer<typeof SignatureHeaders>;

const NONCE_TABLE =
  "CREATE TABLE IF NOT EXISTS market_nonces (nonce TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL)";

export class NonceCache {
  private lastSweep = Number.NEGATIVE_INFINITY;

  constructor(private readonly opts: { sdb: ServerDb; ttlMs: number; now: () => number }) {
    opts.sdb.db.exec(NONCE_TABLE);
  }

  seen(nonce: string): boolean {
    const now = this.opts.now();
    this.sweep(now);
    const db = this.opts.sdb.db;
    const row = db
      .query<{ expiresAt: number }, { nonce: string }>(
        "SELECT expiresAt FROM market_nonces WHERE nonce = $nonce",
      )
      .get({ nonce });
    if (row && row.expiresAt >= now) return true;
    db.query(
      "INSERT INTO market_nonces (nonce, expiresAt) VALUES ($nonce, $expiresAt) ON CONFLICT(nonce) DO UPDATE SET expiresAt = excluded.expiresAt",
    ).run({ nonce, expiresAt: now + this.opts.ttlMs });
    return false;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < Math.min(NONCE_SWEEP_MS, this.opts.ttlMs)) return;
    this.lastSweep = now;
    this.opts.sdb.db.query("DELETE FROM market_nonces WHERE expiresAt < $now").run({ now });
  }
}

const authFailed = () => new KiboError("UNAUTHORIZED", "request authentication failed");

export function signedPath(req: Request): string {
  const url = new URL(req.url);
  return `${url.pathname}${url.search}`;
}

function readSignatureHeaders(req: Request, now: number): SignatureHeaders {
  const h = HTTP_SIGNATURE_HEADERS;
  const parsed = SignatureHeaders.safeParse({
    deviceId: req.headers.get(h.device),
    date: req.headers.get(h.date),
    nonce: req.headers.get(h.nonce),
    signature: req.headers.get(h.signature),
  });
  if (!parsed.success) throw new KiboError("UNAUTHORIZED", "request is not signed");
  if (Math.abs(now - Number(parsed.data.date)) > SIGNED_REQUEST_SKEW_MS) {
    throw new KiboError("UNAUTHORIZED", "request date is too far from the server clock");
  }
  return parsed.data;
}

function activeDevice(sdb: ServerDb, deviceId: string): DeviceRecord {
  const device = deviceRecord(sdb, deviceId);
  if (!device) throw authFailed();
  return device;
}

export function precheckSignedRequest(sdb: ServerDb, req: Request, now: number): void {
  activeDevice(sdb, readSignatureHeaders(req, now).deviceId);
}

export async function verifySignedRequest(
  sdb: ServerDb,
  req: Request,
  body: Uint8Array,
  nonces: NonceCache,
  now: number,
): Promise<{ userId: string; deviceId: string }> {
  const headers = readSignatureHeaders(req, now);
  const device = activeDevice(sdb, headers.deviceId);
  const path = signedPath(req);
  if (CONTROL.test(path)) throw authFailed();
  const payload = httpSigningPayload({
    method: req.method.toUpperCase(),
    path,
    date: headers.date,
    nonce: headers.nonce,
    bodySha256: await sha256Hex(body),
  });
  if (!(await verifyBytes(device.publicKey, payload, headers.signature))) throw authFailed();
  if (device.revoked || device.userDisabled) {
    throw new KiboError("DEVICE_REVOKED", "device or user has been revoked");
  }
  if (nonces.seen(headers.nonce)) throw new KiboError("UNAUTHORIZED", "request nonce was already used");
  touchDevice(sdb, headers.deviceId, now);
  return { userId: device.userId, deviceId: headers.deviceId };
}
