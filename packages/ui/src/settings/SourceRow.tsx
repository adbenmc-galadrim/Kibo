import type { MarketSourceInfo } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { TableCell, TableRow } from "@kibo/sdk/ui/table";
import { Loader2, MoreHorizontal, RefreshCw, Store, Trash2 } from "lucide-react";
import { DetailsBlock } from "../components-page/DetailsBlock";
import { fr } from "../i18n/fr";
import { fingerprintHead } from "../lib/fingerprint";
import { storedErrorText } from "../lib/market-errors";
import { relativeTime } from "../lib/relative-time";

export type SourceAction = "refresh" | "remove";
const CELL = "px-4 py-3 text-xs";
const DAY = 86_400_000;

function updatedText(at: number | null, now: number): string {
  if (at === null) return fr.marketSources.never;
  const days = Math.floor((now - at) / DAY);
  return days === 1 ? fr.marketSources.yesterday : relativeTime(at, now);
}

function StateCell({ source, pending }: { source: MarketSourceInfo; pending: SourceAction | null }) {
  const t = fr.marketSources;
  if (pending)
    return (
      <output className="flex items-center gap-2 text-muted-foreground">
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        {pending === "remove" ? t.removing : t.refreshing}
      </output>
    );
  const failed = source.lastError !== null;
  return (
    <span className="flex items-start gap-2">
      <span
        aria-hidden
        className={cn("mt-1 size-1.5 shrink-0 rounded-full", failed ? "bg-red-500" : "bg-green-500")}
      />
      <span className={failed ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
        {source.lastError ? storedErrorText(source.lastError) : t.ok}
      </span>
    </span>
  );
}

type Props = {
  source: MarketSourceInfo;
  pending: SourceAction | null;
  remote: boolean;
  now: number;
  onAction(action: SourceAction): void;
};

export function SourceRow({ source, pending, remote, now, onAction }: Props) {
  const t = fr.marketSources;
  return (
    <TableRow>
      <TableCell className={`${CELL} font-medium`}>
        <span className="flex items-center gap-2">
          <Store aria-hidden className="size-3.5 text-muted-foreground" />
          {source.name}
        </span>
      </TableCell>
      <TableCell className={`${CELL} max-w-72`}>
        <span className="block truncate font-mono">{source.url}</span>
        <DetailsBlock label={t.details} className="mt-1">
          <span className="font-sans">{t.key}</span>
          <span>{fingerprintHead(source.fingerprint)}</span>
        </DetailsBlock>
      </TableCell>
      <TableCell className={`${CELL} font-mono`}>{source.lastSerial ?? "—"}</TableCell>
      <TableCell className={CELL}>{updatedText(source.lastFetchedAt, now)}</TableCell>
      <TableCell className={`${CELL} w-56 whitespace-normal`}>
        <StateCell source={source} pending={pending} />
      </TableCell>
      <TableCell className={`${CELL} w-12 py-1.5 text-right`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={t.actions(source.name)}
              disabled={pending !== null}
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => onAction("refresh")}>
              <RefreshCw aria-hidden />
              {t.refreshOne}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={remote} onSelect={() => onAction("remove")}>
              <Trash2 aria-hidden />
              {t.remove}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
