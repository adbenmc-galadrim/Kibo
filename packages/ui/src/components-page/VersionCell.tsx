import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { CircleArrowUp } from "lucide-react";
import { frMarket } from "../i18n/fr-market";
import { BLUE_BADGE } from "./market-tones";
import type { ComponentRow } from "./rows";

const RED_BADGE = "border-red-300 text-red-700 dark:border-red-900 dark:text-red-400";

export function VersionCell({ row }: { row: ComponentRow }) {
  const next = row.market?.updateAvailable ?? null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs text-muted-foreground">{row.version}</span>
      {next && (
        <Badge variant="outline" className={`font-normal ${BLUE_BADGE}`}>
          {frMarket.market.available(next)}
        </Badge>
      )}
      {row.revoked && (
        <Badge variant="outline" className={`font-normal ${RED_BADGE}`}>
          {frMarket.market.revokedBadge}
        </Badge>
      )}
    </span>
  );
}

export function RevokedReason({ row }: { row: ComponentRow }) {
  if (!row.revoked) return null;
  return (
    <span className="block text-xs text-destructive">{frMarket.market.authRevoked(row.revoked.reason)}</span>
  );
}

export function UpdateButton({ row, onUpdate }: { row: ComponentRow; onUpdate(to: string): void }) {
  const next = row.market?.updateAvailable ?? null;
  if (!next || !row.summary) return null;
  return (
    <Button size="sm" variant="outline" className="h-7" onClick={() => onUpdate(next)}>
      <CircleArrowUp aria-hidden />
      {frMarket.market.update}
    </Button>
  );
}
