import { Plus } from "lucide-react";
import { fr } from "./fr";
import { OpenLimitBadge } from "./OpenLimitBadge";
import type { PlanningModel } from "./planning-model";

const SEGMENT =
  "flex h-[23px] @max-xl:h-10 items-center rounded-[5px] font-medium text-[12.5px] leading-[15px]";

export type PlanningLayout = "columns" | "bands";

const LAYOUTS: readonly PlanningLayout[] = ["columns", "bands"];
const ACTIVE = "border border-(--tracking-border) bg-(--tracking-bg) px-[9px] text-(--tracking-fg)";
const IDLE = "px-2.5 text-(--tracking-mfg)";

function LayoutToggle({ layout, onLayout }: { layout: PlanningLayout; onLayout(l: PlanningLayout): void }) {
  return (
    <fieldset
      aria-label={fr.layout.label}
      className="flex h-[27px] @max-xl:h-11 items-center gap-0.5 rounded-[7px] bg-(--tracking-muted) p-0.5"
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

const ADD =
  "flex h-[25px] @max-xl:h-11 items-center gap-1.5 rounded-[6px] border border-(--tracking-border) px-2.5 font-medium text-(--tracking-fg) text-[12px] leading-[15px] hover:bg-(--tracking-hover)";

export function AddButton({ label, title, onClick }: { label: string; title: string; onClick(): void }) {
  return (
    <button type="button" title={title} className={ADD} onClick={onClick}>
      <Plus absoluteStrokeWidth size={13} aria-hidden />
      {label}
    </button>
  );
}

type Props = {
  model: PlanningModel;
  layout: PlanningLayout;
  onLayout(layout: PlanningLayout): void;
  onOpen(id: string): void;
  onNewFeature(): void;
  onNewSprint(): void;
};

const SUBTITLE = "min-w-0 truncate text-(--tracking-dim) text-[12.5px] leading-[15px]";

export function PlanningHeader(props: Props) {
  const { model, layout, onOpen, onNewFeature, onNewSprint } = props;
  return (
    <header className="flex shrink-0 flex-wrap items-end gap-2.5">
      <div className="flex min-w-0 grow basis-64 items-end gap-2.5">
        <h1 className="shrink-0 @max-xl:sr-only font-semibold text-(--tracking-fg) text-[22px] leading-[27px]">
          {fr.title}
        </h1>
        <span className={SUBTITLE}>{fr.summary(model.delivered, model.total, model.unplanned)}</span>
        {layout === "bands" && <span className={`${SUBTITLE} shrink-[8]`}>{fr.bands.hint}</span>}
      </div>
      <div className="scrollbar-none ml-auto flex min-w-0 flex-wrap items-end justify-end gap-2.5 @max-xl:-mr-4 @max-xl:-ml-4 @max-xl:w-[calc(100%+2rem)] @max-xl:flex-nowrap @max-xl:items-center @max-xl:justify-start @max-xl:overflow-x-auto @max-xl:px-4 @max-xl:[&>*]:shrink-0">
        <AddButton label={fr.addFeature} title={fr.newFeature} onClick={onNewFeature} />
        <AddButton label={fr.addSprint} title={fr.newSprint} onClick={onNewSprint} />
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
