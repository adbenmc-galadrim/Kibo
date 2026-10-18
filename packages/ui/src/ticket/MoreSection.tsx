import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { frTicketTracking as t } from "../i18n/fr-ticket-tracking";

export function MoreSection({ children }: { children: ReactNode }) {
  return (
    <Collapsible className="grid gap-3 px-4">
      <CollapsibleTrigger className="group flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronRight
          aria-hidden
          className="size-3.5 transition-transform group-data-[state=open]:rotate-90"
        />
        {t.more}
      </CollapsibleTrigger>
      <CollapsibleContent className="-mx-4 grid gap-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
