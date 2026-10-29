import { KiboError, type KiboErrorCode, type ProjectSnapshot, type ProjectSummary } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { frProject } from "../i18n/fr-project";
import { errorMessage } from "../lib/error-message";

type Props = {
  project: ProjectSummary;
  snapshot: ProjectSnapshot | null;
  activeRuns: number;
  onClose(): void;
  onDeleted(projectId: string): void;
};
export type DeleteVariant = "busy" | "delete";

const t = frProject.remove;
const KNOWN: Partial<Record<KiboErrorCode, string>> = t.errors;

export const deleteVariant = (activeRuns: number): DeleteVariant => (activeRuns > 0 ? "busy" : "delete");

export const nameMatches = (typed: string, name: string): boolean => typed.trim() === name;

export function deleteFailure(e: unknown): string {
  const known = e instanceof KiboError ? KNOWN[e.code] : undefined;
  if (!known) console.error(e);
  return `${t.failed} ${known ?? errorMessage(e)}`;
}

type BlockedProps = { title: string; text: string; onClose(): void };

function Blocked({ title, text, onClose }: BlockedProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{text}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t.cancel}
        </Button>
      </DialogFooter>
    </>
  );
}

type ConfirmProps = { project: ProjectSummary; snapshot: ProjectSnapshot | null } & Pick<
  Props,
  "onClose" | "onDeleted"
>;

function useDeletion(projectId: string, onDeleted: (projectId: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.rpc({ method: "deleteProject", projectId });
      onDeleted(projectId);
    } catch (err) {
      setError(deleteFailure(err));
      setBusy(false);
    }
  };
  return { busy, error, remove };
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  );
}

function ConfirmDemo({
  project,
  onClose,
  onDeleted,
}: Pick<ConfirmProps, "project" | "onClose" | "onDeleted">) {
  const { busy, error, remove } = useDeletion(project.id, onDeleted);
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t.demoTitle}</DialogTitle>
        <DialogDescription>{t.demoHelp}</DialogDescription>
      </DialogHeader>
      <ErrorLine error={error} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>
          {t.demoConfirm}
        </Button>
      </DialogFooter>
    </div>
  );
}

function ConfirmByName({ project, snapshot, onClose, onDeleted }: ConfirmProps) {
  const id = useId();
  const [typed, setTyped] = useState("");
  const { busy, error, remove } = useDeletion(project.id, onDeleted);
  const matches = nameMatches(typed, project.name);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (matches) void remove();
  };

  const summary = snapshot
    ? t.summary(snapshot.tickets.length, snapshot.pages.length, snapshot.instances.length)
    : null;
  const keeps = project.folder ? (
    <>
      {t.keepsFolder} <span className="break-all">{project.folder}</span> {t.keepsAfter}
    </>
  ) : (
    t.keepsNoFolder
  );

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t.title(project.name)}</DialogTitle>
        <DialogDescription className="grid min-w-0 gap-1">
          {summary && <span>{summary}</span>}
          <span>{keeps}</span>
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{t.confirmLabel(project.name)}</Label>
        <Input
          id={id}
          value={typed}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>
      <ErrorLine error={error} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="submit" variant="destructive" disabled={busy || !matches}>
          {t.confirm}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function DeleteProjectDialog({ project, snapshot, activeRuns, onClose, onDeleted }: Props) {
  const variant = deleteVariant(activeRuns);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {variant === "busy" && <Blocked title={t.busyTitle} text={t.busy(activeRuns)} onClose={onClose} />}
        {variant === "delete" && project.demo && (
          <ConfirmDemo project={project} onClose={onClose} onDeleted={onDeleted} />
        )}
        {variant === "delete" && !project.demo && (
          <ConfirmByName project={project} snapshot={snapshot} onClose={onClose} onDeleted={onDeleted} />
        )}
      </DialogContent>
    </Dialog>
  );
}
