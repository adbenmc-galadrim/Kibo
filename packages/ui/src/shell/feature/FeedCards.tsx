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
  Radio,
} from "lucide-react";
import { frFeature as t } from "../../i18n/fr-group";
import { ASIDE_EMPTY, AsideCard, AsideRow } from "./AsideCard";
import type { ActivityItem, ActivityKind, FeatureQuestion } from "./feature-feed";

type QuestionsProps = { questions: readonly FeatureQuestion[]; onOpenQuestion(id: string): void };

export function QuestionsCard({ questions, onOpenQuestion }: QuestionsProps) {
  return (
    <AsideCard icon={MessageCircleQuestion} title={t.questions} count={questions.length}>
      {questions.map((q) => (
        <AsideRow key={q.id}>
          <button
            type="button"
            className="flex w-full flex-col items-start gap-[2px] px-[14px] py-[9px] text-left hover:bg-(--tracking-hover)"
            onClick={() => onOpenQuestion(q.id)}
          >
            <span className="w-full truncate text-[12.5px] leading-[15px] text-(--tracking-fg)">
              {q.title}
            </span>
            <span className="text-[11px] leading-[14px] text-(--tracking-dim)">{q.meta}</span>
          </button>
        </AsideRow>
      ))}
      {questions.length === 0 && (
        <AsideRow>
          <p className={ASIDE_EMPTY}>{t.noQuestion}</p>
        </AsideRow>
      )}
    </AsideCard>
  );
}

const ICONS: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  pr_opened: { icon: GitPullRequest, tone: "text-(--tracking-purple)" },
  pr_merged: { icon: GitMerge, tone: "text-(--tracking-green)" },
  review: { icon: GitPullRequest, tone: "text-(--tracking-purple)" },
  step: { icon: Flag, tone: "text-(--tracking-mfg)" },
  branch: { icon: GitBranch, tone: "text-(--tracking-blue)" },
  status: { icon: CircleDot, tone: "text-(--tracking-mfg)" },
  session: { icon: Radio, tone: "text-(--tracking-brand)" },
  sprint: { icon: CalendarRange, tone: "text-(--tracking-mfg)" },
  agent: { icon: Bot, tone: "text-(--tracking-brand)" },
  question: { icon: MessageCircleQuestion, tone: "text-(--tracking-mfg)" },
};

export function ActivityCard({ items }: { items: readonly ActivityItem[] }) {
  return (
    <AsideCard icon={Activity} title={t.activity}>
      {items.map((item) => {
        const { icon: Icon, tone } = ICONS[item.kind];
        return (
          <AsideRow key={item.id}>
            <p className="flex w-full items-center gap-[9px] px-[14px] py-[7px]">
              <Icon absoluteStrokeWidth size={13} aria-hidden className={`size-[13px] shrink-0 ${tone}`} />
              <span className="min-w-0 flex-1 truncate text-[12px] leading-[15px] text-(--tracking-fg)">
                {item.text}
              </span>
              <span className="shrink-0 font-mono text-[11px] leading-[14px] text-(--tracking-dim)">
                {item.time}
              </span>
            </p>
          </AsideRow>
        );
      })}
      {items.length === 0 && (
        <AsideRow>
          <p className={ASIDE_EMPTY}>{t.noActivity}</p>
        </AsideRow>
      )}
    </AsideCard>
  );
}
