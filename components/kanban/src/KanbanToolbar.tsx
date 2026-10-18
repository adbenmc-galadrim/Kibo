import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { ChevronDown, RotateCcw, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { KANBAN_MODES, type KanbanMode, LABEL_ALL } from "./filter";
import { fr } from "./fr";

type Props = {
  mine: string | null;
  mode: KanbanMode;
  onMode: (mode: KanbanMode) => void;
  counts: Record<KanbanMode, number>;
  sprintCode: string | null;
  label: string | null;
  labels: readonly string[];
  onLabel: (label: string | null) => void;
  onShowAll: () => void;
  shown: number;
  hidden: number;
  children?: ReactNode;
};

const isMode = (value: string): value is KanbanMode => KANBAN_MODES.some((m) => m === value);

const modeLabel = (mode: KanbanMode, sprintCode: string | null): string =>
  mode === "sprint" ? fr.mode.sprint(sprintCode) : fr.mode[mode];

const SEGMENT =
  "h-[23px] gap-1.5 rounded-[5px] border border-transparent px-2.5 text-[12.5px] font-medium text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[state=on]:border-border data-[state=on]:bg-background data-[state=on]:text-foreground";

type LabelMenuProps = Pick<Props, "label" | "labels" | "onLabel">;

function LabelMenu({ label, labels, onLabel }: LabelMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          title={fr.labelFilter.label}
          disabled={labels.length === 0 && label === null}
          className="h-[25px] shrink-0 gap-1.5 px-2.5 text-xs font-medium"
        >
          <Tag absoluteStrokeWidth size={13} aria-hidden className="size-[13px]" />
          {label === null ? fr.labelFilter.all : fr.labelFilter.one(label)}
          <ChevronDown absoluteStrokeWidth size={14} aria-hidden className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={label ?? LABEL_ALL}
          onValueChange={(value) => onLabel(value === LABEL_ALL ? null : value)}
        >
          <DropdownMenuRadioItem value={LABEL_ALL} className="text-xs">
            {fr.labelFilter.all}
          </DropdownMenuRadioItem>
          {labels.length > 0 && <DropdownMenuSeparator />}
          {labels.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} className="font-mono text-xs">
              {l}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function KanbanToolbar(props: Props) {
  const { mode, onMode, counts, sprintCode, label, onShowAll, shown, hidden, children } = props;
  return (
    <header className="flex h-12 items-center gap-2 border-b px-4 text-sm">
      <ToggleGroup
        type="single"
        size="sm"
        spacing={0.5}
        aria-label={fr.filter.label}
        value={mode}
        onValueChange={(value) => isMode(value) && onMode(value)}
        className="shrink-0 rounded-[7px] bg-muted p-0.5"
      >
        {KANBAN_MODES.map((m) => (
          <ToggleGroupItem
            key={m}
            value={m}
            aria-label={modeLabel(m, sprintCode)}
            disabled={m === "sprint" && sprintCode === null}
            className={SEGMENT}
          >
            {m === "toFix" && <RotateCcw absoluteStrokeWidth size={12} aria-hidden className="size-3" />}
            {modeLabel(m, sprintCode)}
            <span className="font-mono text-[11px] font-normal text-muted-foreground">{counts[m]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <LabelMenu label={label} labels={props.labels} onLabel={props.onLabel} />
      {children}
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {fr.counter(shown, modeLabel(mode, sprintCode), props.mine)}
      </span>
      {(mode !== "all" || label !== null) && hidden > 0 && (
        <Button size="sm" variant="link" className="h-auto shrink-0 px-0 text-xs" onClick={onShowAll}>
          {fr.hidden(hidden)}
        </Button>
      )}
    </header>
  );
}
