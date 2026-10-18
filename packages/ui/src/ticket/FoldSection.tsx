import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type Props = { title: string; hint?: string; children: ReactNode };

export function FoldSection({ title, hint, children }: Props) {
  return (
    <Collapsible className="grid gap-3">
      <CollapsibleTrigger className="group flex w-fit items-center gap-2 text-[13px]">
        <ChevronRight
          aria-hidden
          className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
        />
        <span className="font-semibold">{title}</span>
        {hint && <span className="text-[12.5px] text-muted-foreground">{hint}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
