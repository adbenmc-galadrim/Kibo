import type { ProjectEventKind, ProjectEventSource } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import {
  Activity,
  Bot,
  CalendarRange,
  CircleDot,
  Flag,
  GitBranch,
  GitMerge,
  GitPullRequest,
  type LucideIcon,
  MessageCircleQuestion,
  Pause,
  Timer,
} from "lucide-react";
import { useState } from "react";
import {
  ACTIVITY_FILTERS,
  ACTIVITY_LONG,
  ACTIVITY_SHORT,
  type ActivityInput,
  type ActivityRow,
  activityRows,
} from "./activity-model";
import { fr } from "./fr";
import { CARD, CardHeader, FeatureChip, MONO_KEY, ROW_LINE } from "./parts";

const ICONS: Record<ProjectEventKind, [LucideIcon, string]> = {
  branch_created: [GitBranch, "text-(--tracking-mfg)"],
  pr_opened: [GitPullRequest, "text-(--tracking-purple)"],
  pr_review: [GitPullRequest, "text-(--tracking-amber)"],
  pr_checks: [GitPullRequest, "text-(--tracking-mfg)"],
  pr_merged: [GitMerge, "text-(--tracking-green)"],
  status_changed: [CircleDot, "text-(--tracking-mfg)"],
  step_set: [Flag, "text-(--tracking-mfg)"],
  session_started: [Timer, "text-(--tracking-brand)"],
  session_stopped: [Timer, "text-(--tracking-mfg)"],
  sprint_created: [CalendarRange, "text-(--tracking-mfg)"],
  sprint_set: [CalendarRange, "text-(--tracking-mfg)"],
  batch_proposed: [Bot, "text-(--tracking-brand)"],
  batch_decided: [Bot, "text-(--tracking-brand)"],
  question_created: [MessageCircleQuestion, "text-(--tracking-mfg)"],
  question_answered: [MessageCircleQuestion, "text-(--tracking-mfg)"],
  question_reminded: [MessageCircleQuestion, "text-(--tracking-brand)"],
  question_deleted: [MessageCircleQuestion, "text-(--tracking-mfg)"],
  held: [Pause, "text-(--tracking-mfg)"],
  resumed: [Pause, "text-(--tracking-mfg)"],
};

function Row({ row, onOpenTicket }: { row: ActivityRow; onOpenTicket(id: string): void }) {
  const [Icon, color] = ICONS[row.kind];
  const tone = row.agent ? "text-(--tracking-brand-text)" : "text-(--tracking-fg)";
  return (
    <li className={cn("flex h-[39px] items-center gap-[10px] px-[16px]", ROW_LINE)}>
      <span className={cn("w-[40px] shrink-0", MONO_KEY)}>{row.time}</span>
      <Icon absoluteStrokeWidth size={14} aria-hidden className={cn("shrink-0", color)} />
      <span className={cn("min-w-0 flex-1 truncate text-[13px] leading-[16px]", tone)}>{row.label}</span>
      <span className="flex w-[110px] shrink-0 items-center justify-end gap-[6px]">
        {row.agent ? (
          <span className="text-(--tracking-brand-text) text-[12px] leading-[15px]">{fr.activity.agent}</span>
        ) : (
          <>
            {row.key !== null && row.ticketId !== null && (
              <button
                type="button"
                className={cn(MONO_KEY, "cursor-pointer hover:underline")}
                onClick={() => onOpenTicket(row.ticketId ?? "")}
              >
                {row.key}
              </button>
            )}
            {row.feature !== null && <FeatureChip shortKey={row.feature} />}
          </>
        )}
      </span>
    </li>
  );
}

type Props = { input: ActivityInput; onOpenTicket(id: string): void };

export function ActivityCard({ input, onOpenTicket }: Props) {
  const [sources, setSources] = useState<readonly ProjectEventSource[]>([]);
  const [long, setLong] = useState(false);
  const rows = activityRows(input, { sources, limit: long ? ACTIVITY_LONG : ACTIVITY_SHORT });
  const toggle = (source: ProjectEventSource) =>
    setSources((current) =>
      current.includes(source) ? current.filter((s) => s !== source) : [...current, source],
    );
  const chips = (
    <div className="flex items-center gap-[8px]">
      {ACTIVITY_FILTERS.map((source) => (
        <button
          key={source}
          type="button"
          aria-pressed={sources.includes(source)}
          className="flex h-[19px] cursor-pointer items-center rounded-[4px] border border-(--tracking-border) px-[6px] font-medium text-(--tracking-mfg) text-[12px] aria-pressed:border-(--tracking-mfg) aria-pressed:bg-(--tracking-muted) aria-pressed:text-(--tracking-fg)"
          onClick={() => toggle(source)}
        >
          {source}
        </button>
      ))}
    </div>
  );
  return (
    <section aria-label={fr.activity.title} className={CARD}>
      <CardHeader
        icon={Activity}
        title={<span title={long ? fr.activity.collapse : fr.activity.expand}>{fr.activity.title}</span>}
        onTitle={() => setLong((v) => !v)}
        aside={chips}
      />
      {rows.length === 0 ? (
        <p className={cn("px-[16px] py-[12px] text-(--tracking-mfg) text-[12.5px]", ROW_LINE)}>
          {fr.activity.none}
        </p>
      ) : (
        <ul className={cn(long && "max-h-[480px] overflow-y-auto")}>
          {rows.map((row) => (
            <Row key={row.id} row={row} onOpenTicket={onOpenTicket} />
          ))}
        </ul>
      )}
    </section>
  );
}
