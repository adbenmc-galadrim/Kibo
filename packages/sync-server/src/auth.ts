import { challengePayload, KiboError } from "@kibo/schema";
import { toBase64, verifyBytes } from "@kibo/trust";
import { deviceRecord, touchDevice } from "./accounts";
import type { ServerDb } from "./db";

export const CHALLENGE_TTL_MS = 30_000;

export function newNonce(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(32)));
}

export class ChallengeNonces {
  private readonly pending = new Map<string, number>();
  private lastSweep = Number.NEGATIVE_INFINITY;

  constructor(private readonly opts: { now: () => number }) {}

  get size(): number {
    return this.pending.size;
  }

  issue(): string {
    this.sweep();
    const nonce = newNonce();
    this.pending.set(nonce, this.opts.now() + CHALLENGE_TTL_MS);
    return nonce;
  }

  consume(nonce: string): boolean {
    const expiresAt = this.pending.get(nonce);
    this.pending.delete(nonce);
    return expiresAt !== undefined && expiresAt >= this.opts.now();
  }

  private sweep(): void {
    const now = this.opts.now();
    if (now - this.lastSweep < CHALLENGE_TTL_MS) return;
    this.lastSweep = now;
    for (const [nonce, expiresAt] of this.pending) if (expiresAt < now) this.pending.delete(nonce);
  }
}

const authFailed = () => new KiboError("UNAUTHORIZED", "authentication failed");

export async function verifyChallenge(
  sdb: ServerDb,
  input: { deviceId: string; signature: string; nonce: string; origin: string },
  now: number,
): Promise<{ userId: string; deviceId: string; name: string }> {
  const device = deviceRecord(sdb, input.deviceId);
  if (!device) throw authFailed();
  const valid = await verifyBytes(
    device.publicKey,
    challengePayload(input.nonce, input.origin),
    input.signature,
  );
  if (!valid) throw authFailed();
  if (device.revoked || device.userDisabled)
    throw new KiboError("DEVICE_REVOKED", "device or user has been revoked");
  touchDevice(sdb, input.deviceId, now);
  return { userId: device.userId, deviceId: input.deviceId, name: device.name };
}
