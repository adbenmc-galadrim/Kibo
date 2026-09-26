import { KiboError, PresenceState, SYNC_LIMITS } from "@kibo/schema";
import { EphemeralStore } from "loro-crdt";

export function presenceIsOwn(bytes: Uint8Array, me: { userId: string; deviceId: string }): boolean {
  const scratch = new EphemeralStore(SYNC_LIMITS.presenceTimeoutMs);
  try {
    try {
      scratch.apply(bytes);
    } catch (e) {
      throw new KiboError("INVALID_INPUT", `unreadable presence: ${String(e)}`);
    }
    const keys = scratch.keys();
    if (keys.length !== 1 || keys[0] !== me.deviceId) return false;
    const parsed = PresenceState.safeParse(scratch.get(me.deviceId));
    return parsed.success && parsed.data.userId === me.userId;
  } finally {
    scratch.destroy();
  }
}
