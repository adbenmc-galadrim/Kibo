import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { BookOpen, Ellipsis, History, RotateCcw } from "lucide-react";
import { useState } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";

type Props = { onReset(): Promise<void>; onPast(): void; onMemory(): void };

const t = frProjectAgent.menu;

export function SessionsMenu({ onReset, onPast, onMemory }: Props) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label={t.label}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setConfirming(true)}>
            <RotateCcw />
            {t.reset}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onPast}>
            <History />
            {t.past}
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
