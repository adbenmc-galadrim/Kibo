import type { FocusMode } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { fr } from "./fr";

type Props = { title: string; page: string | null; focus: FocusMode };

export function OpenOnItch({ page }: { page: string }) {
  return (
    <Button variant="ghost" size="icon-xs" asChild>
      <a href={page} target="_blank" rel="noreferrer noopener" aria-label={fr.open} title={fr.open}>
        <ExternalLink />
      </a>
    </Button>
  );
}

function FocusButton({ focus }: { focus: FocusMode }) {
  const label = focus.active ? fr.exitFullscreen : fr.fullscreen;
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      onClick={focus.active ? focus.exit : focus.request}
    >
      {focus.active ? <Minimize2 /> : <Maximize2 />}
    </Button>
  );
}

export function GameHeader({ title, page, focus }: Props) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 px-3 pt-2 pb-1">
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
      <span className="shrink-0 text-xs text-muted-foreground">{fr.credit}</span>
      {focus.available && <FocusButton focus={focus} />}
      {page && <OpenOnItch page={page} />}
    </div>
  );
}
