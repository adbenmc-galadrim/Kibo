import {
  type IconInput,
  iconUrl,
  KiboError,
  type KiboErrorCode,
  type ProjectPatch,
  type ProjectSummary,
  STORYBOOK_DEFAULTS,
  type StorybookSettings,
  WORKTREE_DEFAULTS,
  type WorktreeSettings,
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
import { FolderField, type FolderFieldProps } from "./FolderField";
import { IconField } from "./IconField";
import { StorybookFields, storybookProblem } from "./StorybookFields";
import { WorktreeFields, worktreeProblem } from "./WorktreeFields";

type Props = {
  project: ProjectSummary;
  onClose(): void;
  remote?: boolean;
  canBrowse?: boolean;
  pick?: FolderFieldProps["pick"];
};
type Fields = {
  name: string;
  color: string;
  folder: string;
  worktree?: WorktreeSettings | null;
  storybook?: StorybookSettings | null;
};

const t = frProject.edit;
const KNOWN: Partial<Record<KiboErrorCode, string>> = t.errors;

const sameWorktree = (a: WorktreeSettings | null, b: WorktreeSettings | null) =>
  JSON.stringify(a ?? WORKTREE_DEFAULTS) === JSON.stringify(b ?? WORKTREE_DEFAULTS);
const sameStorybook = (a: StorybookSettings | null, b: StorybookSettings | null) =>
  JSON.stringify(a ?? STORYBOOK_DEFAULTS) === JSON.stringify(b ?? STORYBOOK_DEFAULTS);

export function projectPatch(project: ProjectSummary, fields: Fields): ProjectPatch | null {
  const patch: ProjectPatch = {};
  const name = fields.name.trim();
  if (name !== project.name) patch.name = name;
  if (fields.color !== project.color) patch.color = fields.color;
  const folder = fields.folder.trim() || null;
  if (folder !== project.folder) patch.folder = folder;
  const worktree = fields.worktree;
  if (worktree !== undefined && !sameWorktree(worktree, project.worktree)) patch.worktree = worktree;
  const storybook = fields.storybook;
  if (storybook !== undefined && !sameStorybook(storybook, project.storybook)) patch.storybook = storybook;
  return Object.keys(patch).length === 0 ? null : patch;
}

export function editFailure(e: unknown): string {
  if (e instanceof KiboError && e.code === "CONFLICT") return t.folderBusy;
  const known = e instanceof KiboError ? KNOWN[e.code] : undefined;
  if (!known) console.error(e);
  return `${t.failed} ${known ?? errorMessage(e)}`;
}

export function EditProjectDialog({ project, onClose, remote = isRemoteView(), canBrowse, pick }: Props) {
  const nameId = useId();
  const folderId = useId();
  const folderHelpId = useId();
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState<string>(project.color);
  const [folder, setFolder] = useState(project.folder ?? "");
  const [worktree, setWorktree] = useState<WorktreeSettings | null>(project.worktree ?? WORKTREE_DEFAULTS);
  const [storybook, setStorybook] = useState<StorybookSettings | null>(
    project.storybook ?? STORYBOOK_DEFAULTS,
  );
  const [pending, setPending] = useState<IconInput | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showWorktree = !remote && folder.trim().length > 0;
  const patch = projectPatch(project, {
    name,
    color,
    folder: remote ? (project.folder ?? "") : folder,
    ...(showWorktree && { worktree }),
    storybook,
  });
  const iconChanged = pending !== null || (removed && Boolean(project.icon));
  const worktreeInvalid = showWorktree && worktree !== null && worktreeProblem(worktree) !== null;
  const storybookInvalid = storybook !== null && storybookProblem(storybook) !== null;
  const dirty =
    name.trim().length > 0 && !worktreeInvalid && !storybookInvalid && (patch !== null || iconChanged);
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
            onError={setError}
          />
          {!remote && (
            <div className="grid gap-1.5">
              <Label htmlFor={folderId}>{t.folder}</Label>
              <FolderField
                id={folderId}
                value={folder}
                onChange={setFolder}
                describedBy={folderHelpId}
                canBrowse={canBrowse}
                pick={pick}
                onError={setError}
              />
              <p id={folderHelpId} className="text-xs text-muted-foreground">
                {t.folderHelp}
              </p>
            </div>
          )}
          {showWorktree && <WorktreeFields value={worktree} onChange={setWorktree} disabled={busy} />}
          <StorybookFields
            value={storybook}
            onChange={setStorybook}
            withPortEnv={showWorktree}
            disabled={busy}
          />
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
