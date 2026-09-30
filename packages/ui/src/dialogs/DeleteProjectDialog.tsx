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
  onOpenAgents(): void;
  onShare(): void;
};
export type DeleteVariant = "busy" | "shared-owner" | "leave" | "delete";

const t = frProject.remove;
const KNOWN: Partial<Record<KiboErrorCode, string>> = t.errors;

export function deleteVariant(snapshot: ProjectSnapshot | null, activeRuns: number): DeleteVariant {
  if (activeRuns > 0) return "busy";
  const sync = snapshot?.sync;
  if (!sync?.shared) return "delete";
  if (sync.role === "owner" && sync.access !== "revoked") return "shared-owner";
  return "leave";
}

export const nameMatches = (typed: string, name: string): boolean => typed.trim() === name;

export function deleteFailure(e: unknown): string {
  const known = e instanceof KiboError ? KNOWN[e.code] : undefined;
  if (!known) console.error(e);
  return `${t.failed} ${known ?? errorMessage(e)}`;
}

type BlockedProps = { title: string; text: string; action: string; onAction(): void; onClose(): void };

function Blocked({ title, text, action, onAction, onClose }: BlockedProps) {
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
        <Button type="button" onClick={onAction}>
          {action}
        </Button>
      </DialogFooter>
    </>
  );
}

type ConfirmProps = { project: ProjectSummary; snapshot: ProjectSnapshot | null; leaving: boolean } & Pick<
  Props,
  "onClose" | "onDeleted"
>;

function ConfirmByName({ project, snapshot, leaving, onClose, onDeleted }: ConfirmProps) {
  const id = useId();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = nameMatches(typed, project.name);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.rpc({ method: "deleteProject", projectId: project.id });
      onDeleted(project.id);
    } catch (err) {
      setError(deleteFailure(err));
      setBusy(false);
    }
  };

  const summary =
    snapshot && !leaving
      ? t.summary(snapshot.tickets.length, snapshot.pages.length, snapshot.instances.length)
      : null;
  const keeps = leaving ? t.leaveHelp : project.folder ? t.keeps(project.folder) : t.keepsNoFolder;

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{leaving ? t.leaveTitle(project.name) : t.title(project.name)}</DialogTitle>
        <DialogDescription className="grid gap-1">
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
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="submit" variant="destructive" disabled={busy || !matches}>
          {leaving ? t.leave : t.confirm}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function DeleteProjectDialog({
  project,
  snapshot,
  activeRuns,
  onClose,
  onDeleted,
  onOpenAgents,
  onShare,
}: Props) {
  const variant = deleteVariant(snapshot, activeRuns);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {variant === "busy" && (
          <Blocked
            title={t.busyTitle}
            text={t.busy(activeRuns)}
            action={t.seeAgents}
            onAction={onOpenAgents}
            onClose={onClose}
          />
        )}
        {variant === "shared-owner" && (
          <Blocked
            title={t.sharedTitle}
            text={t.sharedOwner}
            action={t.openShare}
            onAction={onShare}
            onClose={onClose}
          />
        )}
        {(variant === "delete" || variant === "leave") && (
          <ConfirmByName
            project={project}
            snapshot={snapshot}
            leaving={variant === "leave"}
            onClose={onClose}
            onDeleted={onDeleted}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
