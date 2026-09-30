import {
  type IconInput,
  iconUrl,
  KiboError,
  type KiboErrorCode,
  type ProjectPatch,
  type ProjectSummary,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { frProject } from "../i18n/fr-project";
import { errorMessage } from "../lib/error-message";
import { PROJECT_COLORS } from "../lib/project-colors";
import { isRemoteView } from "../lib/remote-view";
import { FolderField } from "./FolderField";
import { IconField } from "./IconField";

type Props = { project: ProjectSummary; onClose(): void; remote?: boolean };
type Fields = { name: string; color: string; folder: string };

const t = frProject.edit;
const KNOWN: Partial<Record<KiboErrorCode, string>> = t.errors;

export function projectPatch(project: ProjectSummary, fields: Fields): ProjectPatch | null {
  const patch: ProjectPatch = {};
  const name = fields.name.trim();
  if (name !== project.name) patch.name = name;
  if (fields.color !== project.color) patch.color = fields.color;
  const folder = fields.folder.trim() || null;
  if (folder !== project.folder) patch.folder = folder;
  return Object.keys(patch).length === 0 ? null : patch;
}

export function editFailure(e: unknown): string {
  if (e instanceof KiboError && e.code === "CONFLICT") return t.folderBusy;
  const known = e instanceof KiboError ? KNOWN[e.code] : undefined;
  if (!known) console.error(e);
  return `${t.failed} ${known ?? errorMessage(e)}`;
}

export function EditProjectDialog({ project, onClose, remote = isRemoteView() }: Props) {
  const nameId = useId();
  const folderId = useId();
  const folderHelpId = useId();
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState<string>(project.color);
  const [folder, setFolder] = useState(project.folder ?? "");
  const [pending, setPending] = useState<IconInput | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const patch = projectPatch(project, { name, color, folder: remote ? (project.folder ?? "") : folder });
  const iconChanged = pending !== null || (removed && Boolean(project.icon));
  const dirty = name.trim().length > 0 && (patch !== null || iconChanged);
  const currentUrl = project.icon ? iconUrl({ kind: "project", projectId: project.id }, project.icon) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (patch) await client.rpc({ method: "updateProject", projectId: project.id, patch });
      if (iconChanged)
        await client.rpc({
          method: "setIcon",
          owner: { kind: "project", projectId: project.id },
          icon: pending,
        });
      onClose();
    } catch (err) {
      setError(editFailure(err));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={nameId}>{t.name}</Label>
            <Input
              id={nameId}
              value={name}
              maxLength={80}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t.color}</span>
            <RadioGroup value={color} onValueChange={setColor} aria-label={t.color} className="flex gap-2">
              {PROJECT_COLORS.map((hex) => (
                <RadioGroupItem
                  key={hex}
                  value={hex}
                  aria-label={t.colorOption(hex)}
                  className="size-6 rounded-md border-2 border-transparent data-[state=checked]:border-foreground dark:bg-transparent [&>span]:hidden"
                  style={{ background: hex }}
                />
              ))}
            </RadioGroup>
          </div>
          <IconField
            label={t.image}
            currentUrl={currentUrl}
            pending={pending}
            removed={removed}
            onPick={(icon) => {
              setPending(icon);
              setRemoved(false);
            }}
            onRemove={() => {
              setPending(null);
              setRemoved(true);
            }}
          />
          {!remote && (
            <div className="grid gap-1.5">
              <Label htmlFor={folderId}>{t.folder}</Label>
              <FolderField id={folderId} value={folder} onChange={setFolder} describedBy={folderHelpId} />
              <p id={folderHelpId} className="text-xs text-muted-foreground">
                {t.folderHelp}
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={!dirty || busy}>
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
