import { externalRefKey, type FrameProblemKind, frameProblemOf } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Skeleton } from "@kibo/sdk/ui/skeleton";
import { Maximize2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { client } from "../../api";
import { frDesign } from "../../i18n/fr-design";
import { failureText } from "../../lib/remote-error";
import { frameErrorText } from "./design-errors";
import { type DesignRef, refProvider } from "./design-refs";
import type { Thumb } from "./use-design-thumbs";

const t = frDesign.sheet;

const QUIET: ReadonlySet<FrameProblemKind> = new Set(["notConnected", "noThumbnail"]);

const warning = "border-amber-500/50 text-amber-700 dark:text-amber-400";

function Failure({ error, node, onRetry }: { error: unknown; node: DesignRef; onRetry(): void }) {
  const { kind } = frameProblemOf(error, refProvider(node));
  return (
    <div className="relative grid justify-items-center gap-2 p-3 text-center">
      <p role={QUIET.has(kind) ? "status" : "alert"} className="text-muted-foreground">
        {frameErrorText(error, node)}
      </p>
      <Button variant="outline" size="xs" onClick={onRetry}>
        {frDesign.retry}
      </Button>
    </div>
  );
}

function Thumbnail({ thumb, node, onRetry }: { thumb: Thumb; node: DesignRef; onRetry(): void }) {
  if (thumb.state === "failed") return <Failure error={thumb.error} node={node} onRetry={onRetry} />;
  if (thumb.state === "loading") return <Skeleton className="pointer-events-none size-full rounded-none" />;
  const { frame } = thumb;
  return (
    <>
      <img
        src={frame.url}
        alt={node.name}
        crossOrigin="anonymous"
        className="pointer-events-none size-full object-contain"
      />
      {(frame.stale || !frame.reachable) && (
        <div className="pointer-events-none absolute top-1.5 left-1.5 flex gap-1">
          {frame.stale && (
            <Badge variant="outline" className={`bg-background ${warning}`}>
              {frDesign.badges.stale}
            </Badge>
          )}
          {!frame.reachable && (
            <Badge variant="outline" className="bg-background">
              {frDesign.badges.offline}
            </Badge>
          )}
        </div>
      )}
    </>
  );
}

type Props = {
  projectId: string;
  ticketId: string;
  node: DesignRef;
  thumb: Thumb;
  refreshing: boolean;
  onRefresh(): void;
  onFullscreen(): void;
};

export function LinkedFrame({
  projectId,
  ticketId,
  node,
  thumb,
  refreshing,
  onRefresh,
  onFullscreen,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const ready = thumb.state === "ready";
  const unlink = async () => {
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: { method: "removeExternalRef", ticketId, kind: node.kind, key: externalRefKey(node) },
      });
    } catch (e) {
      setError(failureText(e));
    }
  };
  return (
    <li className="grid gap-1.5">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md border bg-muted">
        <button
          type="button"
          aria-label={t.fullscreenOf(node.name)}
          disabled={!ready}
          onClick={onFullscreen}
          className="absolute inset-0 cursor-zoom-in rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        />
        <Thumbnail thumb={thumb} node={node} onRetry={onRefresh} />
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={t.fullscreen}
          title={t.fullscreen}
          disabled={!ready}
          onClick={onFullscreen}
        >
          <Maximize2 aria-hidden />
        </Button>
        <span className="truncate font-medium">{node.name}</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7 shrink-0"
          aria-label={t.refresh}
          title={t.refresh}
          aria-busy={refreshing}
          disabled={thumb.state === "loading" || refreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            aria-hidden
            className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined}
          />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" asChild>
          <a href={node.url} target="_blank" rel="noreferrer noopener">
            {t.open(refProvider(node))}
          </a>
        </Button>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={() => void unlink()}>
          {t.unlink}
        </Button>
      </div>
      {error && <p className="text-destructive">{error}</p>}
    </li>
  );
}
