import { isActiveT3Status, type T3Thread } from "@kibo/schema";
import { cn } from "cn";
import { ExternalLink } from "lucide-react";
import { frT3 as t } from "./fr-t3";

const STYLES = {
  running: {
    box: "border-(--tracking-brand-line) bg-(--tracking-brand-soft)",
    dot: "bg-(--tracking-brand)",
    text: "text-(--tracking-brand-text)",
  },
  waiting: {
    box: "border-(--tracking-amber)/40 bg-(--tracking-amber-soft)",
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

export function ThreadBadge({ thread, now }: { thread: T3Thread; now: number }) {
  if (!isActiveT3Status(thread.status)) return null;
  const waiting = thread.status === "waiting";
  const style = waiting ? STYLES.waiting : STYLES.running;
  return (
    <span
      className={cn(
        "inline-flex h-[27px] shrink-0 items-center gap-2 rounded-[7px] border py-[3px] pr-[3px] pl-2.5",
        style.box,
      )}
    >
      <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", style.dot)} />
      <span className={cn("text-xs font-medium whitespace-nowrap", style.text)}>
        {waiting ? t.waiting : t.running(now - thread.startedAt)}
      </span>
      {thread.link !== "" && <ThreadOpenLink link={thread.link} />}
    </span>
  );
}
