import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type Props = { title: string; summary: string; action?: ReactNode; children: ReactNode };

export function FoldSection({ title, summary, action, children }: Props) {
  return (
    <Collapsible className="group/fold rounded-lg border">
      <div className={action ? "flex items-center gap-2 pr-4" : "flex items-center"}>
        <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-2 px-4 py-3 text-left">
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 transition-transform group-data-[state=open]/fold:rotate-90"
          />
          <span className="shrink-0 text-sm font-semibold">{title}</span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span>
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent className="grid gap-4 border-t px-4 py-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
