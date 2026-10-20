import { type DesignFrame, isHtmlFrame } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@kibo/sdk/ui/dialog";
import { X } from "lucide-react";
import { type KeyboardEvent, useRef } from "react";
import { FrameNav } from "./FrameNav";
import { FrameBadges, OpenInButton, RefreshButton } from "./FrameTools";
import { FrameViewer } from "./FrameViewer";
import { fr } from "./fr";
import { sizeOf } from "./frame-size";

export type FullscreenFrame = { url: string; frame: DesignFrame };
export type FrameFullscreenProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  frames: readonly FullscreenFrame[];
  index: number;
  onIndexChange(index: number): void;
  context?: string;
  refreshing?: boolean;
  onRefresh?(url: string): void;
};

const TRACKING =
  "[--border:var(--tracking-border)] [--card:var(--tracking-card)] [--muted:var(--tracking-muted)] [--secondary:var(--tracking-muted)]";

const COVER =
  "inset-0 top-0 left-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-card p-0 shadow-none sm:max-w-none data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100";

const ICON = "size-3.5";

const STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

function stepOf(e: KeyboardEvent<HTMLElement>): number {
  if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return 0;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return 0;
  return STEPS[e.key] ?? 0;
}

export function FrameFullscreen(props: FrameFullscreenProps) {
  const { open, onOpenChange, frames, index, onIndexChange, context, refreshing = false, onRefresh } = props;
  const exit = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const current = frames[index];
  if (!open || !current) return null;
  const { url, frame } = current;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = stepOf(e);
    if (step === 0) return;
    e.preventDefault();
    const next = index + step;
    if (next >= 0 && next < frames.length) onIndexChange(next);
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-modal
        className={cn(COVER, TRACKING)}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          exit.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          opener.current?.focus();
        }}
        onKeyDown={onKeyDown}
      >
        <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
          {context && <span className="shrink-0 rounded border px-1 font-mono text-2xs">{context}</span>}
          <DialogTitle className="min-w-0 truncate text-sm font-medium">{frame.name}</DialogTitle>
          <FrameBadges frame={frame} />
          <DialogDescription className="sr-only">{fr.fullscreen.hint}</DialogDescription>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {frames.length > 1 && <FrameNav index={index} count={frames.length} onChange={onIndexChange} />}
            {onRefresh && (
              <RefreshButton refreshing={refreshing} onRefresh={() => onRefresh(url)} iconClassName={ICON} />
            )}
            <OpenInButton frame={frame} iconClassName={ICON} />
            <Button ref={exit} variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X aria-hidden />
              {fr.fullscreen.exit}
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <FrameViewer
            key={url}
            surfaces={[{ frame, interactive: true }]}
            size={isHtmlFrame(frame) ? null : sizeOf(frame)}
            mode={null}
            fit="contain"
            name={frame.name}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
