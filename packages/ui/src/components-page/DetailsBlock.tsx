import { cn } from "@kibo/sdk/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type Props = { label: string; className?: string; children: ReactNode };

export function DetailsBlock({ label, className, children }: Props) {
  return (
    <Collapsible className={cn("grid gap-1", className)}>
      <CollapsibleTrigger className="group flex w-fit items-center gap-1 text-2xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <ChevronRight aria-hidden className="size-3 transition-transform group-data-[state=open]:rotate-90" />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-0.5 font-mono text-2xs break-all text-muted-foreground">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
