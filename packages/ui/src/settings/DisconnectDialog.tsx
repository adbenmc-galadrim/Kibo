import type { IntegrationStatus } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { fr } from "../i18n/fr";

type DisconnectableId = "github" | "figma" | "mcp";
export type DisconnectTarget = { id: DisconnectableId; title: string; mode: "gh" | "token" | null };

type Props = {
  target: DisconnectTarget | null;
  onCancel(): void;
  onConfirm(id: DisconnectableId): void;
};

function bodyOf(target: DisconnectTarget): string {
  const t = fr.integrations.disconnect;
  if (target.id === "figma") return t.figma;
  if (target.id === "mcp") return t.mcp;
  return target.mode === "gh" ? t.githubGh : t.githubToken;
}

export function DisconnectDialog({ target, onCancel, onConfirm }: Props) {
  const t = fr.integrations.disconnect;
  if (!target) return null;
  const body = bodyOf(target);
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title(target.title)}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {fr.common.cancel}
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(target.id)}>
            {t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const disconnectable = (s: IntegrationStatus): s is IntegrationStatus & { id: DisconnectableId } =>
  s.id === "github" || s.id === "figma" || s.id === "mcp";
