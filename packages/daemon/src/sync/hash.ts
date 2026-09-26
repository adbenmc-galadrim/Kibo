import { canonicalFields } from "@kibo/core";
import type { SyncedFields } from "@kibo/schema";

export function fieldsHash(f: SyncedFields): string {
  return new Bun.CryptoHasher("sha256").update(canonicalFields(f)).digest("hex");
}
