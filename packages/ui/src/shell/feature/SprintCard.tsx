import type { SprintView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { CalendarRange, ChevronDown, ClockAlert } from "lucide-react";
import { frFeature as t } from "../../i18n/fr-group";
import { ASIDE_ROW, AsideCard, AsideRow } from "./AsideCard";
import type { SprintFacts } from "./feature-model";
import { SprintChip } from "./SprintChip";
import type { SprintProposal } from "./sprint-proposal";
import { STROKE } from "./styles";
import { dateRange } from "./time-format";

type Props = {
  facts: SprintFacts;
  sprints: readonly SprintView[];
  editable: boolean;
  proposal: SprintProposal | null;
  onSetSprint(sprintId: string | null): void;
  onApplyProposal(): void;
};

const MOVE = `h-[25px] gap-[6px] rounded-[6px] border-0 bg-transparent px-[10px] py-[5px] has-[>svg]:px-[10px] text-[12px] leading-[15px] font-medium text-(--tracking-fg) shadow-none dark:bg-transparent ${STROKE} [&_svg:not([class*='size-'])]:size-[13px]`;

function MoveButton({ code, onClick }: { code: string; onClick(): void }) {
  return (
    <Button variant="outline" className={MOVE} onClick={onClick}>
      <CalendarRange absoluteStrokeWidth size={13} />
      {t.moveTo(code)}
    </Button>
  );
}

const describe = (s: SprintView): string => `${s.name} · ${dateRange(s.start, s.end)}`;

function SprintSummary({ sprint }: { sprint: SprintView | null }) {
  if (!sprint)
    return <span className="text-[12.5px] leading-[15px] text-(--tracking-dim)">{t.unplanned}</span>;
  return (
    <>
      <SprintChip code={sprint.code} />
      <span className="min-w-0 truncate text-[12.5px] leading-[15px] text-(--tracking-fg)">
        {describe(sprint)}
      </span>
    </>
  );
}

function SprintPicker({ facts, sprints, editable, onSetSprint }: Props) {
  if (!editable)
    return (
      <div className={ASIDE_ROW}>
        <SprintSummary sprint={facts.sprint} />
      </div>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t.chooseSprint}
        className={`${ASIDE_ROW} outline-none hover:bg-(--tracking-hover)`}
      >
        <SprintSummary sprint={facts.sprint} />
        <ChevronDown
          absoluteStrokeWidth
          size={13}
          aria-hidden
          className="ml-auto size-[13px] shrink-0 text-(--tracking-dim)"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {sprints.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => onSetSprint(s.id)}>
            <span className="font-mono text-xs">{s.code}</span>
            <span className="text-muted-foreground">{describe(s)}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => onSetSprint(null)}>{t.unplanned}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type WarningProps = Omit<Props, "sprints">;

function MoveAction({ facts, editable, proposal, onSetSprint, onApplyProposal }: WarningProps) {
  if (!editable) return null;
  if (proposal)
    return (
      <div className="flex items-center gap-[8px]">
        <MoveButton code={proposal.sprint} onClick={onApplyProposal} />
        <span className="text-[12px] leading-[15px] text-(--tracking-brand-text)">{t.proposedByAgent}</span>
      </div>
    );
  const { following } = facts;
  if (!following) return null;
  return (
    <div className="flex items-center gap-[8px]">
      <MoveButton code={following.code} onClick={() => onSetSprint(following.id)} />
    </div>
  );
}

function Warning(props: WarningProps) {
  const { sprint, warning } = props.facts;
  if (!warning && !(props.proposal && props.editable)) return null;
  const text =
    !sprint || !warning
      ? null
      : warning.kind === "wontFit"
        ? t.wontFit(warning.remaining, sprint.code)
        : t.sprintOver(warning.remaining, sprint.code);
  return (
    <AsideRow>
      <div className="flex w-full items-start gap-[8px] px-[14px] py-[9px]">
        <ClockAlert
          absoluteStrokeWidth
          size={14}
          aria-hidden
          className="size-[14px] shrink-0 text-(--tracking-red)"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          {text && <p className="text-[12.5px] leading-[15px] text-(--tracking-fg)">{text}</p>}
          <MoveAction {...props} />
        </div>
      </div>
    </AsideRow>
  );
}

export function SprintCard(props: Props) {
  return (
    <AsideCard icon={CalendarRange} title={t.sprint}>
      <AsideRow>
        <SprintPicker {...props} />
      </AsideRow>
      <Warning {...props} />
    </AsideCard>
  );
}
