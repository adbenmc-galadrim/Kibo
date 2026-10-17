import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { fr } from "./fr";
import { OpenLimitBadge } from "./OpenLimitBadge";
import type { PlanningModel } from "./planning-model";

const SEGMENT = "flex h-[23px] items-center rounded-[5px] font-medium text-[12.5px] leading-[15px]";

export type PlanningLayout = "columns" | "bands";

const LAYOUTS: readonly PlanningLayout[] = ["columns", "bands"];
const ACTIVE = "border border-(--tracking-border) bg-(--tracking-bg) px-[9px] text-(--tracking-fg)";
const IDLE = "px-2.5 text-(--tracking-mfg)";

function LayoutToggle({ layout, onLayout }: { layout: PlanningLayout; onLayout(l: PlanningLayout): void }) {
  return (
    <fieldset
      aria-label={fr.layout.label}
      className="flex h-[27px] items-center gap-0.5 rounded-[7px] bg-(--tracking-muted) p-0.5"
    >
      {LAYOUTS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === layout}
          className={`${SEGMENT} ${l === layout ? ACTIVE : IDLE}`}
          onClick={() => onLayout(l)}
        >
          {fr.layout[l]}
        </button>
      ))}
    </fieldset>
  );
}

function AddMenu({ onNewFeature, onNewSprint }: { onNewFeature(): void; onNewSprint(): void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={fr.add}
          className="grid size-[25px] place-items-center rounded-[6px] border border-(--tracking-border) text-(--tracking-fg)"
        >
          <Plus absoluteStrokeWidth size={13} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onNewFeature}>{fr.newFeature}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onNewSprint}>{fr.newSprint}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Props = {
  model: PlanningModel;
  readOnly: boolean;
  layout: PlanningLayout;
  onLayout(layout: PlanningLayout): void;
  onOpen(id: string): void;
  onNewFeature(): void;
  onNewSprint(): void;
};

const SUBTITLE = "min-w-0 truncate text-(--tracking-dim) text-[12.5px] leading-[15px]";

export function PlanningHeader(props: Props) {
  const { model, readOnly, layout, onOpen, onNewFeature, onNewSprint } = props;
  return (
    <header className="flex shrink-0 flex-wrap items-end gap-2.5">
      <div className="flex min-w-0 grow basis-64 items-end gap-2.5">
        <h1 className="shrink-0 font-semibold text-(--tracking-fg) text-[22px] leading-[27px]">{fr.title}</h1>
        <span className={SUBTITLE}>{fr.summary(model.delivered, model.total, model.unplanned)}</span>
        {layout === "bands" && <span className={`${SUBTITLE} shrink-[8]`}>{fr.bands.hint}</span>}
      </div>
      <div className="ml-auto flex min-w-0 flex-wrap items-end justify-end gap-2.5">
        {!readOnly && <AddMenu onNewFeature={onNewFeature} onNewSprint={onNewSprint} />}
        <OpenLimitBadge
          open={model.open}
          limit={model.limit}
          over={model.overLimit}
          cards={model.openCards}
          onOpen={onOpen}
        />
        <LayoutToggle layout={layout} onLayout={props.onLayout} />
      </div>
    </header>
  );
}
