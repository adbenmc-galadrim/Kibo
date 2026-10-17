import { Button } from "@kibo/sdk/ui/button";
import { SheetDescription, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Bot, X } from "lucide-react";
import type { ReactNode } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { headerLine, type PanelStatus } from "./conversation";

type Props = {
  project: string;
  status: PanelStatus;
  lastTurnAt: number | null;
  menu: ReactNode;
  onClose(): void;
};

export function PanelHeader({ project, status, lastTurnAt, menu, onClose }: Props) {
  return (
    <header className="flex h-[61px] shrink-0 items-center gap-[10px] border-b border-(--tracking-soft) px-[18px]">
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-(--tracking-brand-line) bg-(--tracking-brand-soft)">
        <Bot aria-hidden className="size-[17px] text-(--tracking-brand)" />
      </span>
      <div className="grid min-w-0 flex-1 gap-[2px] leading-[1.2]">
        <SheetTitle className="truncate text-[14px] font-semibold text-(--tracking-fg)">
          {frProjectAgent.tracking.title}
          <span className="sr-only">{frProjectAgent.titleSuffix(project)}</span>
        </SheetTitle>
        <SheetDescription className="truncate text-[12px] text-(--tracking-mfg)">
          {headerLine(status, lastTurnAt)}
        </SheetDescription>
      </div>
      {menu}
      <Button
        variant="ghost"
        size="icon"
        className="size-[24px] text-(--tracking-mfg) [&_svg:not([class*='size-'])]:size-[16px]"
        aria-label={frProjectAgent.close}
        onClick={onClose}
      >
        <X />
      </Button>
    </header>
  );
}
