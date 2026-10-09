import type { EmbedView } from "@kibo/schema";
import { useEffect, useRef } from "react";
import { cn } from "./lib/utils";

export type EmbedFrameProps = {
  view: EmbedView;
  title: string;
  className?: string;
  onExpired?(): void;
  now?: () => number;
};

export function EmbedFrame({ view, title, className, onExpired, now = Date.now }: EmbedFrameProps) {
  const latest = useRef({ now, onExpired });
  latest.current = { now, onExpired };
  const { expiresAt } = view;
  useEffect(() => {
    if (latest.current.now() >= expiresAt) latest.current.onExpired?.();
  }, [expiresAt]);
  return (
    <iframe
      src={view.url}
      sandbox={view.sandbox}
      allow={view.allow}
      referrerPolicy="no-referrer"
      title={title}
      className={cn("h-full w-full border-0 bg-muted", className)}
    />
  );
}
