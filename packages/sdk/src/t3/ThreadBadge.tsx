import { isActiveT3Status, type T3Thread } from "@kibo/schema";
import { cn } from "cn";
import { ClockAlert, ExternalLink } from "lucide-react";
import { frT3 as t } from "./fr-t3";

const STYLES = {
  running: {
    box: "border-(--tracking-brand-line) bg-(--tracking-brand-soft)",
    soft: "bg-(--tracking-brand-soft)",
    dot: "bg-(--tracking-brand)",
    text: "text-(--tracking-brand-text)",
  },
  waiting: {
    box: "border-(--tracking-amber)/40 bg-(--tracking-amber-soft)",
    soft: "bg-(--tracking-amber-soft)",
    dot: "bg-(--tracking-amber)",
    text: "text-(--tracking-amber)",
  },
};

export function ThreadOpenLink({ link }: { link: string }) {
  return (
    <a
      href={link}
      className="inline-flex h-[21px] shrink-0 items-center gap-1.5 rounded-[6px] border bg-background px-2 text-xs font-medium text-foreground hover:bg-accent"
    >
      {t.open}
      <ExternalLink aria-hidden className="size-3" />
    </a>
  );
}

type ThreadMarkProps = { thread: T3Thread; now: number };

const stateText = (thread: T3Thread, now: number): string =>
  thread.status === "waiting" ? t.waiting : t.running(now - thread.startedAt);

const styleOf = (thread: T3Thread) => (thread.status === "waiting" ? STYLES.waiting : STYLES.running);

function StateMark({ thread, size }: { thread: T3Thread; size: string }) {
  if (thread.status === "waiting")
    return <ClockAlert aria-hidden className={cn("size-3 shrink-0", styleOf(thread).text)} />;
  return <span aria-hidden className={cn("shrink-0 rounded-full", size, styleOf(thread).dot)} />;
}

export function ThreadPill({ thread, now }: ThreadMarkProps) {
  if (!isActiveT3Status(thread.status)) return null;
  const style = styleOf(thread);
  return (
    <span
      role="img"
      aria-label={stateText(thread, now)}
      className={cn(
        "inline-flex h-[17px] shrink-0 items-center gap-1 rounded-[9px] px-1.5 text-[11px] font-semibold",
        style.soft,
        style.text,
      )}
    >
      <StateMark thread={thread} size="size-1.5" />
      {t.pill}
    </span>
  );
}

export function ThreadBadge({ thread, now, compact = false }: ThreadMarkProps & { compact?: boolean }) {
  if (!isActiveT3Status(thread.status)) return null;
  const style = styleOf(thread);
  if (compact)
    return (
      <span
        className={cn(
          "inline-flex h-[18px] w-fit max-w-full items-center gap-[5px] rounded-[10px] px-[7px]",
          style.soft,
        )}
      >
        <StateMark thread={thread} size="size-1.5" />
        <span className={cn("truncate text-[11px] font-medium", style.text)}>{stateText(thread, now)}</span>
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex h-[27px] shrink-0 items-center gap-2 rounded-[7px] border py-[3px] pr-[3px] pl-2.5",
        style.box,
      )}
    >
      <StateMark thread={thread} size="size-[7px]" />
      <span className={cn("text-xs font-medium whitespace-nowrap", style.text)}>
        {stateText(thread, now)}
      </span>
      {thread.link !== "" && <ThreadOpenLink link={thread.link} />}
    </span>
  );
}
