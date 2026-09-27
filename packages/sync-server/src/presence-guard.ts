import { KiboError, PresenceState, SYNC_LIMITS } from "@kibo/schema";
import { EphemeralStore } from "loro-crdt";

export function ownPresence(
  bytes: Uint8Array,
  me: { userId: string; deviceId: string },
): PresenceState | null {
  const scratch = new EphemeralStore(SYNC_LIMITS.presenceTimeoutMs);
  try {
    try {
      scratch.apply(bytes);
    } catch (e) {
      throw new KiboError("INVALID_INPUT", `unreadable presence: ${String(e)}`);
    }
    const keys = scratch.keys();
    if (keys.length !== 1 || keys[0] !== me.deviceId) return null;
    const parsed = PresenceState.safeParse(scratch.get(me.deviceId));
    return parsed.success && parsed.data.userId === me.userId ? parsed.data : null;
  } finally {
    scratch.destroy();
  }
}
