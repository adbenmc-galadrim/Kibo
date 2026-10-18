import { featureLabel, type TicketView } from "@kibo/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { Package } from "lucide-react";
import { fr } from "./fr";

export type FeatureRef = Pick<TicketView, "id" | "key" | "keyLabel" | "shortKey" | "title">;
type Props = { feature: FeatureRef; onOpen(id: string): void };

export const featureKey = (f: Omit<FeatureRef, "id" | "title">): string => featureLabel(f) || f.keyLabel;

export const featureName = (f: FeatureRef): string => fr.feature.name(featureKey(f), f.title);

export function FeatureChip({ feature, onOpen }: Props) {
  const name = featureName(feature);
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={fr.feature.open(name)}
            className="inline-flex h-[15px] max-w-full min-w-0 items-center gap-1 rounded-[4px] border border-(--tracking-border) px-[5px] text-(--tracking-mfg) hover:bg-(--tracking-hover)"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(feature.id);
            }}
          >
            <Package
              absoluteStrokeWidth
              size={11}
              aria-hidden
              className="size-[11px] shrink-0 text-(--tracking-dim)"
            />
            <span data-slot="feature-name" className="truncate text-[10.5px] leading-[1.2] font-medium">
              {name}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={4}
          className="rounded-[6px] px-2.5 py-1.5 text-[12px] [&_svg]:hidden"
        >
          {name}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
