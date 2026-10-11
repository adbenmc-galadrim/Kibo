import type { PartialReason } from "@kibo/schema";
import { frMoments } from "../i18n/fr-moments";

export function RawMoment({ text, partial }: { text: string; partial: PartialReason | null }) {
  if (partial) return <p className="text-xs italic text-muted-foreground">{frMoments.partial[partial]}</p>;
  return <p className="font-mono text-[11px] break-all text-muted-foreground">{text}</p>;
}
