import {
  type IconInput,
  iconUrl,
  KiboError,
  type KiboErrorCode,
  type ProjectEditField,
  type ProjectSummary,
  STORYBOOK_DEFAULTS,
  type StorybookSettings,
  type TrackingSettings,
  type WorkspaceConfig,
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
import { DescriptionField } from "./DescriptionField";
import { FolderField, type FolderFieldProps } from "./FolderField";
import { GuidelinesField } from "./GuidelinesField";
import { IconField } from "./IconField";
import { projectPatch } from "./project-patch";
import { RecipientsFields } from "./RecipientsFields";
import { StorybookFields, storybookProblem } from "./StorybookFields";
import { TrackingSection } from "./TrackingSection";

type Props = {
  project: ProjectSummary;
  onClose(): void;
  canBrowse?: boolean;
  pick?: FolderFieldProps["pick"];
  config?: WorkspaceConfig | null;
  focus?: ProjectEditField;
};
const t = frProject.edit;
const KNOWN: Partial<Record<KiboErrorCode, string>> = t.errors;

export function editFailure(e: unknown): string {
  if (e instanceof KiboError && e.code === "CONFLICT") return t.folderBusy;
  const known = e instanceof KiboError ? KNOWN[e.code] : undefined;
  if (!known) console.error(e);
  return `${t.failed} ${known ?? errorMessage(e)}`;
}

export function EditProjectDialog({ project, onClose, canBrowse, pick, config, focus }: Props) {
  const nameId = useId();
  const folderId = useId();
  const folderHelpId = useId();
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState<string>(project.color);
  const [description, setDescription] = useState(project.description ?? "");
  const [folder, setFolder] = useState(project.folder ?? "");
  const [storybook, setStorybook] = useState<StorybookSettings | null>(
    project.storybook ?? STORYBOOK_DEFAULTS,
  );
  const [tracking, setTracking] = useState<TrackingSettings | null>(project.tracking);
  const [saved] = useState<ProjectSummary>(project);
  const [pending, setPending] = useState<IconInput | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showWorktree = folder.trim().length > 0;
  const patch = projectPatch(saved, {
    name,
    color,
    description,
    tracking,
    folder,
    storybook,
  });
  const iconChanged = pending !== null || (removed && Boolean(project.icon));
  const storybookInvalid = storybook !== null && storybookProblem(storybook) !== null;
  const dirty = name.trim().length > 0 && !storybookInvalid && (patch !== null || iconChanged);
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
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
        aria-describedby={undefined}
      >
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
              autoFocus={focus === undefined}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DescriptionField value={description} onChange={setDescription} disabled={busy} />
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
              autoFocus={focus === "folder"}
            />
            <p id={folderHelpId} className="text-xs text-muted-foreground">
              {t.folderHelp}
            </p>
          </div>
          <StorybookFields
            value={storybook}
            onChange={setStorybook}
            withPortEnv={showWorktree}
            disabled={busy}
          />
          {config && <GuidelinesField project={project} config={config} />}
          <TrackingSection value={tracking} onChange={setTracking} disabled={busy} />
          <RecipientsFields projectId={project.id} />
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
