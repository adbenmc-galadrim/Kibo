import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { Plus } from "lucide-react";
import { fr } from "./fr";
import { OpenLimitBadge } from "./OpenLimitBadge";
import type { PlanningModel } from "./planning-model";

const SEGMENT = "flex h-[23px] items-center rounded-[5px] font-medium text-[12.5px] leading-[15px]";

function LayoutToggle() {
  return (
    <TooltipProvider>
      <fieldset
        aria-label={fr.layout.label}
        className="flex h-[27px] items-center gap-0.5 rounded-[7px] bg-(--tracking-muted) p-0.5"
      >
        <button
          type="button"
          aria-pressed="true"
          className={`${SEGMENT} border border-(--tracking-border) bg-(--tracking-bg) px-[9px] text-(--tracking-fg)`}
        >
          {fr.layout.columns}
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span data-slot="bands" title={fr.layout.soon}>
              <button
                type="button"
                disabled
                aria-pressed="false"
                className={`${SEGMENT} px-2.5 text-(--tracking-mfg)`}
              >
                {fr.layout.bands}
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{fr.layout.soon}</TooltipContent>
        </Tooltip>
      </fieldset>
    </TooltipProvider>
  );
}

function AddMenu({ onNewFeature, onNewSprint }: { onNewFeature(): void; onNewSprint(): void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={fr.add}
          className="ml-auto grid size-[25px] place-items-center rounded-[6px] border border-(--tracking-border) text-(--tracking-fg)"
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
  onOpen(id: string): void;
  onNewFeature(): void;
  onNewSprint(): void;
};

export function PlanningHeader({ model, readOnly, onOpen, onNewFeature, onNewSprint }: Props) {
  return (
    <header className="flex shrink-0 items-end gap-2.5">
      <h1 className="font-semibold text-(--tracking-fg) text-[22px] leading-[27px]">{fr.title}</h1>
      <span className="text-(--tracking-dim) text-[12.5px] leading-[15px]">
        {fr.summary(model.delivered, model.total, model.unplanned)}
      </span>
      {readOnly ? (
        <span className="ml-auto" />
      ) : (
        <AddMenu onNewFeature={onNewFeature} onNewSprint={onNewSprint} />
      )}
      <OpenLimitBadge
        open={model.open}
        limit={model.limit}
        over={model.overLimit}
        cards={model.openCards}
        onOpen={onOpen}
      />
      <LayoutToggle />
    </header>
  );
}
