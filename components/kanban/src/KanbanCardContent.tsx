import type { CiRun, MemberInfo, TicketRun, TicketView } from "@kibo/schema";
import { AgentBadge, assigneeLabel, type CiTone, TicketKeyLabel, worstCiTone } from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { Bot } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "./fr";
import { LabelChips } from "./LabelChips";

const CI_DOT = {
  ok: "bg-emerald-500",
  error: "bg-red-500",
  running: "bg-amber-500",
  neutral: "bg-muted-foreground/60",
} as const satisfies Record<CiTone, string>;

export const CARD_CLASS =
  "relative grid gap-2 rounded-md border bg-card p-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type CiChip = { tone: CiTone; prNumber: number | null };

export function ciChipOf(runs: CiRun[]): CiChip | undefined {
  const tone = worstCiTone(runs);
  if (tone === null) return undefined;
  const latest = [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return { tone, prNumber: latest?.prNumber ?? null };
}

export type CardFacts = {
  ticket: TicketView;
  run: TicketRun | null;
  ci?: CiChip;
  members: MemberInfo[];
  remote: { label: string; state: string }[];
};

type Props = CardFacts & { menu: ReactNode; title: ReactNode };

export function KanbanCardContent({ ticket: t, run, ci, members, remote, menu, title }: Props) {
  return (
    <>
      <div className="flex h-6 items-center gap-2">
        <TicketKeyLabel ticket={t} className="font-mono text-2xs text-muted-foreground" />
        <span className="flex-1" />
        {menu}
      </div>
      {title}
      <LabelChips labels={t.labels} />
      {t.blockedReason && (
        <p className="text-2xs text-red-600 dark:text-red-400">{fr.blockedReason(t.blockedReason)}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <AgentBadge agent={t.assignee?.kind === "agent" ? t.assignee.ref : null} run={run} texts={fr.run} />
        {remote.map((r) => (
          <span
            key={r.label}
            className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-3xs text-brand-strong dark:text-brand"
          >
            <Bot aria-hidden className="size-3" />
            {r.label}
          </span>
        ))}
        {t.assignee?.kind === "human" && members.length > 0 && (
          <Badge variant="outline" className="text-3xs font-normal">
            {assigneeLabel(t.assignee, members)}
          </Badge>
        )}
        {t.waitingOn.map((k) => (
          <Badge key={k} variant="outline" className="text-3xs">
            {fr.waitingOn(k)}
          </Badge>
        ))}
        {ci && (
          <span
            title={fr.ci[ci.tone]}
            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-3xs"
          >
            <span
              role="img"
              aria-label={fr.ci[ci.tone]}
              className={`size-2 rounded-full ${CI_DOT[ci.tone]}`}
            />
            {ci.prNumber !== null && `#${ci.prNumber}`}
          </span>
        )}
        {t.progress.total > 0 && (
          <span className="ml-auto font-mono text-3xs text-muted-foreground">{`${t.progress.done}/${t.progress.total}`}</span>
        )}
      </div>
    </>
  );
}
