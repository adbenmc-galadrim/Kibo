import { Button } from "@kibo/sdk/ui/button";
import { SheetDescription, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Bot, List, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { ReactNode } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { HEADER_ICON, NewAgentButton } from "./NewAgentButton";

type Props = {
  project: string;
  wide: boolean;
  listShown: boolean;
  canReset: boolean;
  onList(): void;
  onNew(): void;
  onWide(): void;
  onClose(): void;
};

const t = frProjectAgent.header;

function IconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={HEADER_ICON}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function ListButton({ wide, listShown, onList }: Pick<Props, "wide" | "listShown" | "onList">) {
  if (!wide)
    return (
      <IconButton label={t.list} pressed={listShown} onClick={onList}>
        <List />
      </IconButton>
    );
  return (
    <IconButton label={listShown ? t.hideList : t.showList} onClick={onList}>
      {listShown ? <PanelLeftClose /> : <PanelLeftOpen />}
    </IconButton>
  );
}

export function PanelHeader({ project, wide, listShown, canReset, onList, onNew, onWide, onClose }: Props) {
  return (
    <header className="flex h-[56px] shrink-0 items-center gap-[10px] border-b border-(--tracking-soft) pr-[10px] pl-[16px]">
      <span className="flex size-[28px] shrink-0 items-center justify-center rounded-full border border-(--tracking-brand-line) bg-(--tracking-brand-soft)">
        <Bot aria-hidden className="size-[15px] text-(--tracking-brand)" />
      </span>
      <SheetTitle className="min-w-0 flex-1 truncate text-[13px] font-semibold text-(--tracking-fg)">
        {t.title(project)}
      </SheetTitle>
      <SheetDescription className="sr-only">{frProjectAgent.conversation.label}</SheetDescription>
      <div className="flex shrink-0 items-center gap-[2px]">
        <ListButton wide={wide} listShown={listShown} onList={onList} />
        <NewAgentButton variant="icon" canReset={canReset} onNew={onNew} />
        <IconButton label={wide ? t.shrink : t.expand} onClick={onWide}>
          {wide ? <Minimize2 /> : <Maximize2 />}
        </IconButton>
        <IconButton label={frProjectAgent.close} onClick={onClose}>
          <X />
        </IconButton>
      </div>
    </header>
  );
}
