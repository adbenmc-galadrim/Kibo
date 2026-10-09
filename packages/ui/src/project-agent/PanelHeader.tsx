import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { SheetDescription, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import type { PanelStatus } from "./conversation";

type Props = { project: string; status: PanelStatus; menu: ReactNode; onClose(): void };

const ACTIVE: ReadonlySet<PanelStatus> = new Set(["thinking", "batch"]);

export function PanelHeader({ project, status, menu, onClose }: Props) {
  return (
    <header className="flex items-center gap-2 border-b px-3 py-2">
      <Sparkles className="size-4 shrink-0 text-brand-strong dark:text-brand" aria-hidden />
      <SheetTitle className="min-w-0 flex-1 truncate text-sm">{frProjectAgent.title(project)}</SheetTitle>
      <SheetDescription asChild>
        <Badge
          variant="outline"
          className={cn(ACTIVE.has(status) && "border-brand/50 text-brand-strong dark:text-brand")}
        >
          {frProjectAgent.status[status]}
        </Badge>
      </SheetDescription>
      {menu}
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={frProjectAgent.close}
        onClick={onClose}
      >
        <X />
      </Button>
    </header>
  );
}
