import type { ExternalRef } from "@kibo/schema";
import { frRefs } from "./fr-refs";

export function importTitle(refs: readonly ExternalRef[]): string | undefined {
  const lines = refs.flatMap((r) => (r.kind === "import_ref" ? [frRefs.imported(r.source, r.id)] : []));
  return lines.length > 0 ? lines.join("\n") : undefined;
}
