import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { CalendarRange, Ellipsis, Link, Pause, Play } from "lucide-react";
import { fr } from "./fr";
import type { HeldGroup, HeldStep } from "./held-model";

export type HeldHandlers = {
  onOpen(ticketId: string): void;
  onResume(step: HeldStep): void;
  onResumeIn(step: HeldStep, sprintId: string): void;
};
type Props = HeldHandlers & { groups: readonly HeldGroup[] };

function heldEntries(step: HeldStep, handlers: HeldHandlers): MenuEntry[] {
  const resume: MenuEntry = { label: fr.held.resume, icon: Play, onSelect: () => handlers.onResume(step) };
  if (step.resumeTargets.length === 0) return [resume];
  const items = step.resumeTargets.map((s) => ({
    label: fr.held.target(s.code, s.name),
    onSelect: () => handlers.onResumeIn(step, s.id),
  }));
  return [resume, { label: fr.held.resumeIn, icon: CalendarRange, items }];
}

function StepMenu({ step, entries }: { step: HeldStep; entries: readonly MenuEntry[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={fr.cardActions(step.key)}
          className="ml-auto grid size-[14px] shrink-0 place-items-center rounded-[3px] text-(--tracking-dim) hover:text-(--tracking-fg)"
        >
          <Ellipsis absoluteStrokeWidth size={13} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuEntries entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MONO = "font-mono text-(--tracking-dim) text-[11px] leading-[14px]";

function StepCard({ step, handlers }: { step: HeldStep; handlers: HeldHandlers }) {
  return (
    <article
      aria-label={`${step.key} ${step.title}`}
      className="flex w-full flex-col gap-[3px] rounded-[6px] border border-(--tracking-border) bg-(--tracking-card) px-[9px] py-[6px]"
    >
      <div className="flex h-[14px] items-center gap-[5px]">
        <span className={MONO}>{step.key}</span>
        <span aria-hidden className="text-(--tracking-faint) text-[11px] leading-[14px]">
          ·
        </span>
        <span className={MONO}>{step.featureKey}</span>
        <StepMenu step={step} entries={heldEntries(step, handlers)} />
      </div>
      <button
        type="button"
        title={step.title}
        className="cursor-pointer truncate text-left font-medium text-(--tracking-fg) text-[13px] leading-[16px]"
        onClick={() => handlers.onOpen(step.ticketId)}
      >
        {step.title}
      </button>
    </article>
  );
}

function Group({ group, handlers }: { group: HeldGroup; handlers: HeldHandlers }) {
  return (
    <fieldset aria-label={group.reason} className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <p className="text-(--tracking-mfg) text-[13px] leading-[18px]">{group.reason}</p>
      {group.steps.map((s) => (
        <StepCard key={s.ticketId} step={s} handlers={handlers} />
      ))}
      {group.dependents > 0 && (
        <span className="flex h-[14px] items-center gap-1.5 px-0.5 text-(--tracking-dim) text-[11.5px] leading-[14px]">
          <Link absoluteStrokeWidth size={12} aria-hidden />
          {fr.held.dependents(group.dependents)}
        </span>
      )}
    </fieldset>
  );
}

export function HeldSection({ groups, ...handlers }: Props) {
  const count = groups.reduce((n, g) => n + g.steps.length, 0);
  if (count === 0) return null;
  const title = fr.held.title(count);
  return (
    <section aria-label={title} className="mt-auto flex shrink-0 flex-col gap-3 px-0.5 pt-2.5 pb-0.5">
      <div className="flex h-4 items-center gap-1.5">
        <Pause absoluteStrokeWidth size={14} aria-hidden className="text-(--tracking-hold)" />
        <span className="font-semibold text-(--tracking-fg) text-[13px] leading-[16px]">{title}</span>
      </div>
      {groups.map((g) => (
        <Group key={g.reason} group={g} handlers={handlers} />
      ))}
    </section>
  );
}
