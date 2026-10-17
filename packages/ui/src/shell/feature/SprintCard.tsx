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
import { STROKE } from "./styles";
import { dateRange } from "./time-format";

type Props = {
  facts: SprintFacts;
  sprints: readonly SprintView[];
  editable: boolean;
  onSetSprint(sprintId: string | null): void;
};

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

function Warning({ facts, editable, onSetSprint }: Omit<Props, "sprints">) {
  const { sprint, following, warning } = facts;
  if (!sprint || !warning) return null;
  const code = sprint.code;
  const text =
    warning.kind === "wontFit" ? t.wontFit(warning.remaining, code) : t.sprintOver(warning.remaining, code);
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
          <p className="text-[12.5px] leading-[15px] text-(--tracking-fg)">{text}</p>
          {editable && following && (
            <div className="flex items-center gap-[8px]">
              <Button
                variant="outline"
                className={`h-[25px] gap-[6px] rounded-[6px] border-0 bg-transparent px-[10px] py-[5px] has-[>svg]:px-[10px] text-[12px] leading-[15px] font-medium text-(--tracking-fg) shadow-none dark:bg-transparent ${STROKE} [&_svg:not([class*='size-'])]:size-[13px]`}
                onClick={() => onSetSprint(following.id)}
              >
                <CalendarRange absoluteStrokeWidth size={13} />
                {t.moveTo(following.code)}
              </Button>
            </div>
          )}
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
      <Warning facts={props.facts} editable={props.editable} onSetSprint={props.onSetSprint} />
    </AsideCard>
  );
}
