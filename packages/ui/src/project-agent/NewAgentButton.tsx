import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Plus } from "lucide-react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { READING_COLUMN } from "./reading-column";

type Props = { variant: "icon" | "block"; canReset: boolean; onNew(): void };

export const HEADER_ICON =
  "size-7 rounded-md text-(--tracking-mfg) aria-pressed:bg-muted [&_svg:not([class*='size-'])]:size-[15px]";

const t = frProjectAgent.reset;

export function NewAgentButton({ variant, canReset, onNew }: Props) {
  if (variant === "icon")
    return (
      <Button
        variant="ghost"
        size="icon"
        className={HEADER_ICON}
        aria-label={frProjectAgent.header.newAgent}
        disabled={!canReset}
        onClick={onNew}
      >
        <Plus />
      </Button>
    );
  return (
    <div className="shrink-0 border-t border-(--tracking-soft) px-[18px] py-[14px]">
      <Button variant="outline" className={cn(READING_COLUMN, "flex")} disabled={!canReset} onClick={onNew}>
        <Plus />
        {frProjectAgent.header.newAgent}
      </Button>
    </div>
  );
}

type ConfirmProps = { open: boolean; onOpenChange(open: boolean): void; onReset(): Promise<void> };

export function NewAgentConfirm({ open, onOpenChange, onReset }: ConfirmProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.title}
      description={t.description}
      confirmLabel={t.confirm}
      cancelLabel={t.cancel}
      onConfirm={onReset}
      describeError={() => frProjectAgent.resetFailed}
    />
  );
}
