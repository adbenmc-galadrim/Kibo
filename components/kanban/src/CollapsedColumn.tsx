import type { Status } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import type { Ref } from "react";
import { fr } from "./fr";

type Props = { status: Status; forbidden: boolean; ref: Ref<HTMLElement> };

export function CollapsedColumn({ status, forbidden, ref }: Props) {
  return (
    <section
      ref={ref}
      aria-label={status.label}
      data-collapsed="true"
      data-forbidden={forbidden || undefined}
      className={cn(
        "flex min-h-0 w-10 shrink-0 flex-col items-center gap-2.5 rounded-lg bg-muted/40 pt-3",
        forbidden && "cursor-not-allowed opacity-50",
      )}
    >
      <StatusDot statusId={status.id} />
      <span className="text-[12.5px] font-semibold [writing-mode:vertical-rl]">{status.label}</span>
      <span className="font-mono text-[11px] text-muted-foreground [writing-mode:vertical-rl]">
        {fr.tickets(0)}
      </span>
    </section>
  );
}
