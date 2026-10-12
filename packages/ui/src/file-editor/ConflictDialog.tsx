import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { RefreshCw } from "lucide-react";
import { CodeEditor } from "../files/CodeEditor";
import { fr } from "../i18n/fr";
import { frAgentsSkills } from "../i18n/fr-agents-skills";

type Props = {
  path: string;
  mine: string;
  disk: string;
  modifiedAt: number | null;
  onReload(): void;
  onOverwrite(): void;
  onCancel(): void;
};

const t = frAgentsSkills.conflict;

const clock = (at: number) =>
  new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function ConflictDialog({ path, mine, disk, modifiedAt, onReload, onOverwrite, onCancel }: Props) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>
            <code className="font-mono text-foreground">{path}</code> {t.description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <p className="flex justify-between font-medium">
            {t.mine}
            <span className="font-normal text-muted-foreground">{t.unsaved}</span>
          </p>
          <p className="flex justify-between font-medium">
            {t.disk}
            {modifiedAt !== null && (
              <span className="font-normal text-muted-foreground">{clock(modifiedAt)}</span>
            )}
          </p>
        </div>
        <div className="flex h-72 min-h-0 flex-col overflow-hidden rounded-lg border">
          <CodeEditor
            initial={disk}
            original={mine}
            path={path}
            layout="split"
            label={t.title}
            wrap
            readOnly
            onChange={() => {}}
            onSave={() => {}}
          />
        </div>
        <p className="text-2xs text-muted-foreground">{t.help}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {fr.common.cancel}
          </Button>
          <Button variant="outline" onClick={onReload}>
            <RefreshCw />
            {t.reload}
          </Button>
          <Button onClick={onOverwrite}>{t.overwrite}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
