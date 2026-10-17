import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { BookOpen, Ellipsis, History, LayoutList, MessagesSquare, Radar, RotateCcw } from "lucide-react";
import { useState } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";

type Props = {
  signals: number;
  onTracking?(): void;
  onConversation(): void;
  onSignals(): void;
  onReset(): Promise<void>;
  onPast(): void;
  onMemory(): void;
};

const t = frProjectAgent.menu;

export function PanelMenu({
  signals,
  onTracking,
  onConversation,
  onSignals,
  onReset,
  onPast,
  onMemory,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-[24px] text-(--tracking-mfg) [&_svg:not([class*='size-'])]:size-[16px]"
            aria-label={t.label}
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onTracking && (
            <DropdownMenuItem onSelect={onTracking}>
              <LayoutList />
              {t.tracking}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onConversation}>
            <MessagesSquare />
            {t.conversation}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onSignals}>
            <Radar />
            {t.signals(signals)}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onPast}>
            <History />
            {t.past}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirming(true)}>
            <RotateCcw />
            {t.reset}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onMemory}>
            <BookOpen />
            {t.memory}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={frProjectAgent.reset.title}
        description={frProjectAgent.reset.description}
        confirmLabel={frProjectAgent.reset.confirm}
        cancelLabel={frProjectAgent.reset.cancel}
        onConfirm={onReset}
        describeError={() => frProjectAgent.resetFailed}
      />
    </>
  );
}
