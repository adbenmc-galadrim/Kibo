import { useAutoAnimate } from "@kibo/sdk/ui/auto-animate";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Ellipsis,
  Link,
  Pause,
  Play,
} from "lucide-react";
import { useState } from "react";
import { fr } from "./fr";
import { readBandFolded, writeBandFolded } from "./held-band-pref";
import type { HeldGroup, HeldStep } from "./held-model";

export type HeldHandlers = {
  onOpen(ticketId: string): void;
  onResume(step: HeldStep): void;
  onResumeIn(step: HeldStep, sprintId: string): void;
};
type Props = HeldHandlers & { projectId: string; groups: readonly HeldGroup[] };

function heldEntries(step: HeldStep, handlers: HeldHandlers): MenuEntry[] {
  const resume: MenuEntry = { label: fr.held.resume, icon: Play, onSelect: () => handlers.onResume(step) };
  if (step.resumeTargets.length === 0) return [resume];
  const items = step.resumeTargets.map((s) => ({
    label: fr.held.target(s.code, s.name),
    onSelect: () => handlers.onResumeIn(step, s.id),
  }));
  return [resume, { label: fr.held.resumeIn, icon: CalendarRange, items }];
}

function ChipMenu({ step, entries }: { step: HeldStep; entries: readonly MenuEntry[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={fr.cardActions(step.key)}
          className="absolute top-[3px] right-[3px] grid size-[13px] place-items-center rounded-[3px] bg-(--tracking-card) text-(--tracking-dim) opacity-0 hover:text-(--tracking-fg) focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <Ellipsis absoluteStrokeWidth size={13} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuEntries entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MONO = "font-mono text-(--tracking-mfg) text-[11.5px] leading-[14px]";

function StepChip({ step, handlers }: { step: HeldStep; handlers: HeldHandlers }) {
  return (
    <article
      aria-label={`${step.key} ${step.title}`}
      className="group relative flex h-[21px] min-w-0 items-center gap-1.5 rounded-[6px] border border-(--tracking-border) bg-(--tracking-card) px-[7px]"
    >
      <span className={MONO}>{step.key}</span>
      <span aria-hidden className="text-(--tracking-faint) text-[11.5px] leading-[14px]">
        ·
      </span>
      <span className={MONO}>{step.featureKey}</span>
      <button
        type="button"
        title={step.title}
        className="max-w-[240px] cursor-pointer truncate text-left font-medium text-(--tracking-fg) text-[12.5px] leading-[15px]"
        onClick={() => handlers.onOpen(step.ticketId)}
      >
        {step.title}
      </button>
      <ChipMenu step={step} entries={heldEntries(step, handlers)} />
    </article>
  );
}

function ReasonRow({ group, handlers }: { group: HeldGroup; handlers: HeldHandlers }) {
  return (
    <fieldset
      aria-label={group.reason}
      className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0"
    >
      <p className="text-(--tracking-mfg) text-[12.5px] leading-[15px]">{group.reason}</p>
      {group.steps.map((s) => (
        <StepChip key={s.ticketId} step={s} handlers={handlers} />
      ))}
      {group.dependents > 0 && (
        <span className="flex h-[15px] items-center gap-1 text-(--tracking-dim) text-[12px] leading-[15px]">
          <Link absoluteStrokeWidth size={12} aria-hidden />
          {fr.held.dependents(group.dependents)}
          <ChevronRight absoluteStrokeWidth size={12} aria-hidden />
        </span>
      )}
    </fieldset>
  );
}

function BandHeader({ count, folded }: { count: number; folded: boolean }) {
  const Chevron = folded ? ChevronDown : ChevronUp;
  return (
    <div className="flex h-4 items-center gap-2">
      <Pause absoluteStrokeWidth size={14} aria-hidden className="text-(--tracking-hold)" />
      <span className="font-semibold text-(--tracking-fg) text-[13px] leading-[16px]">{fr.held.label}</span>
      <span className="flex h-[13px] items-center rounded-[4px] bg-(--tracking-muted) px-[5px] font-medium font-mono text-(--tracking-mfg) text-[10.5px] leading-[13px]">
        {count}
      </span>
      <span className="text-(--tracking-dim) text-[12px] leading-[15px]">{fr.held.hint(count)}</span>
      <CollapsibleTrigger className="ml-auto flex h-[15px] cursor-pointer items-center gap-1 text-(--tracking-mfg) text-[12px] leading-[15px] hover:text-(--tracking-fg)">
        {folded ? fr.held.unfold : fr.held.fold}
        <Chevron absoluteStrokeWidth size={13} aria-hidden />
      </CollapsibleTrigger>
    </div>
  );
}

export function HeldBand({ projectId, groups, ...handlers }: Props) {
  const [folded, setFolded] = useState(() => readBandFolded(projectId));
  const [rows] = useAutoAnimate<HTMLDivElement>();
  const count = groups.reduce((n, g) => n + g.steps.length, 0);
  if (count === 0) return null;
  const toggle = (open: boolean) => {
    setFolded(!open);
    writeBandFolded(projectId, !open);
  };
  return (
    <section
      aria-label={fr.held.title(count)}
      className="shrink-0 rounded-[10px] border border-(--tracking-border) bg-(--tracking-panel) px-[13px] py-[9px]"
    >
      <Collapsible open={!folded} onOpenChange={toggle}>
        <BandHeader count={count} folded={folded} />
        <CollapsibleContent>
          <div ref={rows} className="flex flex-col gap-2 pt-2">
            {groups.map((g) => (
              <ReasonRow key={g.reason} group={g} handlers={handlers} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
