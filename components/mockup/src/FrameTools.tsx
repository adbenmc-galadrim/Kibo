import { type DesignFrame, isHtmlFrame } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";
import { fr } from "./fr";

export function FrameBadges({ frame }: { frame: DesignFrame }) {
  const image = !isHtmlFrame(frame);
  return (
    <>
      <Badge variant="secondary">{fr.provider[frame.provider]}</Badge>
      {image && frame.stale && <Badge variant="outline">{fr.stale}</Badge>}
      {image && !frame.reachable && <Badge variant="outline">{fr.offline}</Badge>}
    </>
  );
}

type IconProps = { iconClassName?: string };

export function RefreshButton({
  refreshing,
  onRefresh,
  iconClassName,
}: IconProps & { refreshing: boolean; onRefresh(): void }) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={fr.refresh}
      title={fr.refresh}
      aria-busy={refreshing}
      disabled={refreshing}
      onClick={onRefresh}
    >
      <RefreshCw className={cn(iconClassName, refreshing && "animate-spin motion-reduce:animate-none")} />
    </Button>
  );
}

export function OpenInButton({ frame, iconClassName }: IconProps & { frame: DesignFrame }) {
  return (
    <Button variant="ghost" size="icon-xs" asChild>
      <a
        href={frame.source}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={fr.open(frame.provider)}
        title={fr.open(frame.provider)}
      >
        <ExternalLink className={iconClassName} />
      </a>
    </Button>
  );
}
