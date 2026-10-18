import { useDroppable } from "@dnd-kit/core";
import type { SprintPhase } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { CalendarRange, CircleCheck, ClockAlert, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { dashedBorder } from "./dashes";
import { fr } from "./fr";
import { PenpotStroke } from "./PenpotStroke";
import type { SprintColumn as Column } from "./planning-model";
import { STEPS_PER_WEEK } from "./sprint-load";

export const COLUMN_CLASS =
  "flex w-[214px] shrink-0 flex-col gap-2.5 overflow-y-auto rounded-[10px] border p-[9px] scrollbar-none";

const BAR_WIDTH = 104;

const DROP_SIDES = dashedBorder({ width: 194, height: 120, radius: 8, color: "var(--tracking-fg)" });

const CURRENT_STROKE = "var(--tracking-mfg)";

function SprintProgress({ delivered, total }: { delivered: number; total: number }) {
  const fill = total === 0 ? 0 : Math.round((BAR_WIDTH * delivered) / total);
  return (
    <div className="flex h-[14px] items-center gap-1.5">
      <span className="h-[3px] w-[104px] rounded-[1.5px] bg-(--tracking-border)">
        <span className="block h-[3px] rounded-[1.5px] bg-(--tracking-green)" style={{ width: fill }} />
      </span>
      <span className="text-(--tracking-dim) text-[11px] leading-[14px]">
        {fr.deliveredOf(delivered, total)}
      </span>
    </div>
  );
}

const CHIP =
  "ml-auto flex h-[17px] items-center gap-1 whitespace-nowrap rounded-[4px] px-1.5 text-[10.5px] leading-[13px] font-medium";

function StateChip({ phase }: { phase: SprintPhase }) {
  if (phase === "ended")
    return (
      <span className={cn(CHIP, "bg-(--tracking-green-soft) text-(--tracking-green)")}>
        <CircleCheck absoluteStrokeWidth size={12} aria-hidden />
        {fr.sprintState.done}
      </span>
    );
  return (
    <span className={cn(CHIP, "bg-(--tracking-muted) text-(--tracking-fg)")}>
      {phase === "ends-today" ? fr.sprintState.endsToday : fr.sprintState.current}
    </span>
  );
}

function SprintLoadLine({ load }: { load: Column["load"] }) {
  return (
    <span
      data-over={load.over}
      title={fr.loadHint(STEPS_PER_WEEK)}
      className={cn(
        "text-[11px] leading-[14px]",
        load.over ? "text-(--tracking-amber)" : "text-(--tracking-dim)",
      )}
    >
      {fr.load(load.steps, load.capacity)}
    </span>
  );
}

type HeaderProps = { column: Column; onOpen(): void; onEdit?: (() => void) | undefined };

function SprintHeader({ column, onOpen, onEdit }: HeaderProps) {
  const { sprint } = column;
  const started = column.phase !== "upcoming";
  return (
    <header className="flex flex-col gap-1 px-0.5 pt-0.5 pb-1">
      <div className="flex h-4 min-w-0 items-center gap-1.5 text-(--tracking-fg)">
        <button
          type="button"
          aria-label={fr.openSprint(column.code, sprint.name)}
          className="flex h-4 min-w-0 cursor-pointer items-center gap-1.5 text-left"
          onClick={onOpen}
        >
          <span className="font-mono font-semibold text-[13px] leading-[16px]">{column.code}</span>
          <span className="truncate font-semibold text-[13px] leading-[16px]">{sprint.name}</span>
        </button>
        {onEdit && (
          <button
            type="button"
            aria-label={fr.editSprint}
            title={fr.editSprint}
            className="grid size-4 shrink-0 cursor-pointer place-items-center rounded-[4px] text-(--tracking-dim) hover:text-(--tracking-fg)"
            onClick={onEdit}
          >
            <Pencil absoluteStrokeWidth size={14} aria-hidden className="size-[14px]" />
          </button>
        )}
      </div>
      <div className="flex min-h-[14px] items-center gap-1.5">
        <span className="text-(--tracking-dim) text-[11.5px] leading-[14px]">{column.dates}</span>
        {started ? (
          <StateChip phase={column.phase} />
        ) : (
          <span className="ml-auto text-(--tracking-dim) text-[11.5px] leading-[14px]">
            {fr.planned(sprint.total)}
          </span>
        )}
      </div>
      {started && <SprintProgress delivered={sprint.delivered} total={sprint.total} />}
      <SprintLoadLine load={column.load} />
    </header>
  );
}

export function DropZone({ label, dates }: { label: string; dates: string | null }) {
  return (
    <div
      data-slot="planning-dropzone"
      className="flex h-[120px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[8px] bg-(--tracking-muted)"
      style={DROP_SIDES}
    >
      <CalendarRange absoluteStrokeWidth size={16} aria-hidden className="text-(--tracking-fg)" />
      <span className="font-medium text-(--tracking-fg) text-[12px] leading-[15px]">{label}</span>
      {dates !== null && <span className="text-(--tracking-dim) text-[11px] leading-[14px]">{dates}</span>}
    </div>
  );
}

export function Warning({ children, tone = "red" }: { children: ReactNode; tone?: "red" | "amber" }) {
  return (
    <p
      role="note"
      className={cn(
        "flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[11.5px] leading-[14px]",
        tone === "red"
          ? "bg-(--tracking-red-soft) text-(--tracking-red)"
          : "bg-(--tracking-amber-soft) text-(--tracking-amber)",
      )}
    >
      <ClockAlert absoluteStrokeWidth size={13} aria-hidden className="shrink-0" />
      <span>{children}</span>
    </p>
  );
}

type Props = {
  column: Column;
  dropping: boolean;
  onOpen(): void;
  onEdit?: (() => void) | undefined;
  children: ReactNode;
  footer?: ReactNode;
};

export function SprintColumn({ column, dropping, onOpen, onEdit, children, footer }: Props) {
  const { setNodeRef } = useDroppable({ id: column.sprint.id });
  const current = column.sprint.state === "current";
  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.code} ${column.sprint.name}`}
      data-state={column.sprint.state}
      className="relative flex shrink-0 flex-col"
    >
      <div
        className={cn(
          COLUMN_CLASS,
          "min-h-0 flex-1",
          current
            ? "border-transparent bg-(--tracking-card)"
            : "border-(--tracking-border) bg-(--tracking-panel)",
        )}
      >
        <SprintHeader column={column} onOpen={onOpen} onEdit={onEdit} />
        {children}
        {dropping && <DropZone label={fr.dropIn(column.code)} dates={column.dates} />}
        {column.warnings.map((w) => (
          <Warning key={w.shortKey} tone={w.tone}>
            {w.tone === "red" ? fr.lateBy(w.shortKey, w.remaining) : fr.wontHold(w.shortKey, w.remaining)}
          </Warning>
        ))}
        {footer}
      </div>
      {current && <PenpotStroke color={CURRENT_STROKE} radius={10} border={0} />}
    </section>
  );
}
