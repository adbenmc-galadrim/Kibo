import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";

const OPEN_DELAY_MS = 300;
const SIDE_OFFSET_PX = 10;

export type TooltipRow = readonly [label: string, value: ReactNode];

type Props = { rows: readonly TooltipRow[]; suppressed?: boolean; children: ReactElement };

export function TooltipRows({ rows, suppressed = false, children }: Props) {
  if (rows.length === 0) return children;
  return (
    <TooltipPrimitive.Provider delayDuration={OPEN_DELAY_MS}>
      <TooltipPrimitive.Root {...(suppressed ? { open: false } : {})}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            data-slot="tooltip-rows"
            side="right"
            align="start"
            sideOffset={SIDE_OFFSET_PX}
            className="z-50 grid w-[300px] grid-cols-[74px_minmax(0,1fr)] gap-x-3 gap-y-[7px] rounded-lg border bg-popover px-3 py-2.5 text-xs leading-[14px] text-popover-foreground shadow-md"
          >
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <span className="text-muted-foreground">{label}</span>
                <span className="wrap-anywhere">{value}</span>
              </div>
            ))}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
