import type { PresencePeer } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { frPresence } from "../i18n/fr-presence";
import { usePresencePeers } from "../state/use-presence";

const MAX = 3;
const DISC = "grid place-items-center rounded-full border-2 border-background bg-muted font-semibold";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

type Props = {
  project: { id: string; name: string };
  pages: { id: string; title: string }[];
  pageId?: string | null;
};

function visiblePeers(all: PresencePeer[], pageId: string | null | undefined): PresencePeer[] {
  return all
    .filter((p) => !p.self && (pageId === undefined || p.pageId === pageId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function PresenceAvatars({ project, pages, pageId }: Props) {
  const peers = visiblePeers(usePresencePeers(project.id), pageId);
  if (peers.length === 0) return null;
  const place = (id: string | null) => {
    const page = pages.find((p) => p.id === id);
    return page ? `${project.name} › ${page.title}` : null;
  };
  const onPage = pageId !== undefined;
  const size = onPage ? "size-5 text-3xs" : "size-6 text-3xs";
  return (
    <TooltipProvider>
      <div className="flex shrink-0 items-center gap-1.5">
        <ul className="flex items-center -space-x-1.5" aria-label={frPresence.label}>
          {peers.slice(0, MAX).map((p) => (
            <li key={p.deviceId} className="flex">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span role="img" aria-label={p.name} className={cn(DISC, size)}>
                    {initials(p.name)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{frPresence.where(p.name, place(p.pageId))}</TooltipContent>
              </Tooltip>
            </li>
          ))}
          {peers.length > MAX && (
            <li className={cn(DISC, size, "font-normal")}>{`+${peers.length - MAX}`}</li>
          )}
        </ul>
        {onPage && (
          <span className="hidden text-xs text-muted-foreground md:inline">
            {frPresence.watchingPage(peers.map((p) => p.name))}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
