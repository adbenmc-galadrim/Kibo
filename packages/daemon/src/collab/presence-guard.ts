import { KiboError, PresenceRun, PresenceState, SYNC_LIMITS } from "@kibo/schema";
import { EphemeralStore } from "loro-crdt";
import { z } from "zod";

export const PRESENCE_LIMITS = { peers: 100, frameBytes: 1024 * 1024, textLength: 256 } as const;

const Text = z.string().max(PRESENCE_LIMITS.textLength);

const BoundedRun = PresenceRun.extend({ ticketKey: Text.nullable(), profile: Text, state: Text });

export const BoundedPresenceState = PresenceState.extend({
  userId: Text.min(1),
  name: Text,
  pageId: Text.nullable(),
  ticketId: Text.nullable(),
  runs: z.array(BoundedRun).max(50),
});

export function incomingKeys(bytes: Uint8Array, known: ReadonlySet<string>): string[] {
  if (bytes.byteLength > PRESENCE_LIMITS.frameBytes) {
    throw new KiboError("TOO_LARGE", `presence frame of ${bytes.byteLength} bytes`);
  }
  const scratch = new EphemeralStore(SYNC_LIMITS.presenceTimeoutMs);
  try {
    try {
      scratch.apply(bytes);
    } catch (e) {
      throw new KiboError("INVALID_INPUT", `unreadable presence: ${String(e)}`);
    }
    const keys = scratch.keys();
    const added = keys.filter((key) => !known.has(key)).length;
    if (keys.length > PRESENCE_LIMITS.peers || known.size + added > PRESENCE_LIMITS.peers) {
      throw new KiboError("TOO_LARGE", `presence for more than ${PRESENCE_LIMITS.peers} devices`);
    }
    return keys;
  } finally {
    scratch.destroy();
  }
}
