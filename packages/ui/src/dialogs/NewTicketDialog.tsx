import { type Assignee, type ProjectMeta, type ProjectSnapshot, StatusId } from "@kibo/schema";
import { type NewTicketDefaults, StatusDot } from "@kibo/sdk";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { displayName } from "../lib/inbox";

export type NewTicketDialogProps = {
  projects: readonly ProjectMeta[];
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
  initialProjectId: string;
  lockProject: boolean;
  viewer: string;
  defaults: NewTicketDefaults;
  onClose(): void;
};

const t = fr.newTicket;
const NOBODY = "none";
const ME = "me";

function keyLine(project: ProjectSnapshot | null): string {
  if (!project) return fr.lazy.loading;
  return project.nextTicketKey === null ? t.keyPending : t.key(project.nextTicketKey);
}

const nameOf = (meta: ProjectMeta | undefined): string => (meta ? displayName(meta) : fr.lazy.loading);

function assigneeOf(value: string, me: string): Assignee | null {
  if (value === NOBODY) return null;
  return { kind: "human", ref: value === ME ? me : value };
}

type ProjectFieldProps = {
  id: string;
  projects: readonly ProjectMeta[];
  value: string;
  locked: { name: string; help: string } | null;
  onChange(projectId: string): void;
};

function ProjectField({ id, projects, value, locked, onChange }: ProjectFieldProps) {
  if (locked) {
    return (
      <div className="grid gap-1 text-sm">
        <p className="font-medium">{t.projectFixed(locked.name)}</p>
        <p className="text-muted-foreground">{locked.help}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t.project}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {displayName(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type AssigneeFieldProps = {
  id: string;
  project: ProjectSnapshot | null;
  viewer: string;
  value: string;
  onChange(v: string): void;
};

function AssigneeField({ id, project, viewer, value, onChange }: AssigneeFieldProps) {
  const me = project?.viewer ?? viewer;
  const members = project?.sync.shared ? project.sync.members.filter((m) => m.userId !== me) : [];
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t.assignee}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOBODY}>{t.nobody}</SelectItem>
          <SelectItem value={ME}>{t.me(viewer)}</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function NewTicketDialog(p: NewTicketDialogProps) {
  const { defaults, onClose } = p;
  const id = useId();
  const [projectId, setProjectId] = useState(p.initialProjectId);
  const project = p.snapshots.get(projectId) ?? null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState<StatusId>(defaults.statusId ?? "todo");
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState(ME);
  const [failed, setFailed] = useState(false);
  const blocked = statusId === "blocked";
  const parent = project?.tickets.find((x) => x.id === defaults.parentId);
  const ready = project !== null && title.trim() !== "" && (!blocked || reason.trim() !== "");
  const pickProject = (next: string) => {
    setProjectId(next);
    setAssignee(ME);
  };
  const pickStatus = (v: string) => {
    const parsed = StatusId.safeParse(v);
    if (parsed.success) setStatusId(parsed.data);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!project || !ready) return;
    setFailed(false);
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: {
          method: "createTicket",
          title: title.trim(),
          description,
          statusId,
          ...(blocked && { blockedReason: reason.trim() }),
          parentId: defaults.parentId ?? null,
          assignee: assigneeOf(assignee, project.viewer ?? p.viewer),
        },
        ...(defaults.instanceId && { instanceId: defaults.instanceId }),
      });
    } catch {
      setFailed(true);
      return;
    }
    onClose();
  };
  const workflow = [...(project?.workflow ?? [])].sort((a, b) => a.order - b.order);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{keyLine(project)}</DialogDescription>
          </DialogHeader>
          <ProjectField
            id={`${id}-project`}
            projects={p.projects}
            value={projectId}
            locked={
              p.lockProject
                ? {
                    name: nameOf(project?.meta ?? p.projects.find((x) => x.id === projectId)),
                    help: defaults.parentId ? t.projectLocked : t.projectFromWidget,
                  }
                : null
            }
            onChange={pickProject}
          />
          {parent && (
            <p className="text-sm text-muted-foreground">
              {t.parent} : <span className="font-mono">{parent.keyLabel}</span> {parent.title}
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor={`${id}-title`}>{t.name}</Label>
            <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-description`}>{t.description}</Label>
            <Textarea
              id={`${id}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-status`}>{t.status}</Label>
              <Select value={statusId} onValueChange={pickStatus}>
                <SelectTrigger id={`${id}-status`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workflow.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <StatusDot statusId={s.id} />
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AssigneeField
              id={`${id}-assignee`}
              project={project}
              viewer={p.viewer}
              value={assignee}
              onChange={setAssignee}
            />
          </div>
          {blocked && (
            <div className="grid gap-2">
              <Label htmlFor={`${id}-reason`}>{t.reason}</Label>
              <Textarea
                id={`${id}-reason`}
                required
                aria-describedby={`${id}-reason-help`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p id={`${id}-reason-help`} className="text-xs text-muted-foreground">
                {t.reasonHelp}
              </p>
            </div>
          )}
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t.failed}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={!ready}>
              {t.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
