import { type DesignFrame, isHtmlFrame } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "./fr";

type Props = { frame: DesignFrame; refreshing: boolean; onRefresh(): void; children?: ReactNode };

export function FrameHeader({ frame, refreshing, onRefresh, children }: Props) {
  const image = !isHtmlFrame(frame);
  return (
    <div className="flex min-w-0 items-center gap-1.5 px-3 pt-2 pb-1">
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{frame.name}</p>
      <Badge variant="secondary">{fr.provider[frame.provider]}</Badge>
      {image && frame.stale && <Badge variant="outline">{fr.stale}</Badge>}
      {image && !frame.reachable && <Badge variant="outline">{fr.offline}</Badge>}
      {children}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={fr.refresh}
        title={fr.refresh}
        aria-busy={refreshing}
        disabled={refreshing}
        onClick={onRefresh}
      >
        <RefreshCw className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined} />
      </Button>
      <Button variant="ghost" size="icon-xs" asChild>
        <a
          href={frame.source}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={fr.open(frame.provider)}
          title={fr.open(frame.provider)}
        >
          <ExternalLink />
        </a>
      </Button>
    </div>
  );
}
