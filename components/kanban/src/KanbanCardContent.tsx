import type { CiRun, MemberInfo, TicketRun, TicketView } from "@kibo/schema";
import {
  assigneeLabel,
  type CiTone,
  DeliveryStepChip,
  GroupChip,
  type GroupRef,
  QuestionsChip,
  type QuestionsChipData,
  TicketKeyLabel,
  useSdk,
  worstCiTone,
} from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { Bot } from "lucide-react";
import type { ReactNode } from "react";
import { AgentChip } from "./AgentChip";
import { fr } from "./fr";
import { LabelChips } from "./LabelChips";

const CI_DOT = {
  ok: "bg-emerald-500",
  error: "bg-red-500",
  running: "bg-amber-500",
  neutral: "bg-muted-foreground/60",
} as const satisfies Record<CiTone, string>;

export const STARTABLE_BADGE =
  "border-zinc-400 bg-background text-2xs font-medium text-zinc-700 dark:border-zinc-500 dark:text-zinc-200";

export const CARD_TITLE_CLASS = "w-fit max-w-full text-left wrap-anywhere";

export const CARD_CLASS =
  "relative grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-md border bg-card p-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type CiChip = { tone: CiTone; prNumber: number | null };

export function ciChipOf(runs: CiRun[]): CiChip | undefined {
  const tone = worstCiTone(runs);
  if (tone === null) return undefined;
  const latest = [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return { tone, prNumber: latest?.prNumber ?? null };
}

export type CardFacts = {
  ticket: TicketView;
  group: GroupRef | null;
  run: TicketRun | null;
  ci?: CiChip;
  members: MemberInfo[];
  remote: { label: string; state: string }[];
  questions: QuestionsChipData;
};

type Props = CardFacts & { menu: ReactNode; title: ReactNode };

export function KanbanCardContent(props: Props) {
  const { ticket: t, group, run, ci, members, remote, questions, menu, title } = props;
  const sdk = useSdk();
  return (
    <>
      <div className="flex h-6 items-center gap-2">
        <TicketKeyLabel ticket={t} className="min-w-0 truncate font-mono text-2xs text-muted-foreground" />
        {group && <GroupChip group={group} onOpen={(id) => sdk.openTicket(id)} />}
        <span className="flex-1" />
        {menu}
      </div>
      {title}
      <LabelChips labels={t.labels} />
      {t.blockedReason && (
        <p className="text-2xs text-red-600 wrap-anywhere dark:text-red-400">
          {fr.blockedReason(t.blockedReason)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {t.startable && (
          <Badge variant="outline" className={STARTABLE_BADGE}>
            {fr.startable}
          </Badge>
        )}
        <AgentChip
          agent={t.assignee?.kind === "agent" ? t.assignee.ref : null}
          run={run}
          className="max-w-full"
        />
        <DeliveryStepChip ticket={t} />
        {remote.map((r) => (
          <span
            key={r.label}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-3xs text-brand-strong dark:text-brand"
          >
            <Bot aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{r.label}</span>
          </span>
        ))}
        {t.assignee?.kind === "human" && members.length > 0 && (
          <Badge variant="outline" className="max-w-full text-3xs font-normal">
            <span className="truncate">{assigneeLabel(t.assignee, members)}</span>
          </Badge>
        )}
        {t.waitingOn.map((k) => (
          <Badge key={k} variant="outline" className="max-w-full text-3xs">
            <span className="truncate">{fr.waitingOn(k)}</span>
          </Badge>
        ))}
        {t.openQuestions > 0 && (
          <QuestionsChip
            {...questions}
            ticket={t}
            text={fr.questions(t.openQuestions)}
            label={fr.questionsOpen(t.openQuestions)}
          />
        )}
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
      </div>
    </>
  );
}
