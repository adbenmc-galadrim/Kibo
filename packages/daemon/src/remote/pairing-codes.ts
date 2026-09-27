import type { PairingCode } from "@kibo/schema";
import { constantTimeEqual, newPairingCode, normalizeCode, utf8 } from "@kibo/trust";

export const PAIRING_CODE_TTL_MS = 5 * 60_000;
export const PAIRING_MAX_FAILURES = 5;

export type Redemption = "paired" | "invalid" | "rate-limited";

export class PairingCodes {
  private readonly active = new Map<string, number>();
  private failures = 0;

  constructor(private readonly now: () => number) {}

  create(): PairingCode {
    const code = newPairingCode();
    const expiresAt = this.now() + PAIRING_CODE_TTL_MS;
    this.active.set(code, expiresAt);
    this.failures = 0;
    return { code, expiresAt };
  }

  redeem(input: string): Redemption {
    if (this.failures >= PAIRING_MAX_FAILURES) return "rate-limited";
    this.dropExpired();
    const match = this.find(normalizeCode(input));
    if (match !== null) {
      this.active.delete(match);
      return "paired";
    }
    this.failures += 1;
    if (this.failures < PAIRING_MAX_FAILURES) return "invalid";
    this.active.clear();
    return "rate-limited";
  }

  private dropExpired(): void {
    const at = this.now();
    for (const [code, expiresAt] of this.active) if (expiresAt <= at) this.active.delete(code);
  }

  private find(candidate: string): string | null {
    const typed = utf8(candidate);
    let match: string | null = null;
    for (const code of this.active.keys()) if (constantTimeEqual(typed, utf8(code))) match = code;
    return match;
  }
}
