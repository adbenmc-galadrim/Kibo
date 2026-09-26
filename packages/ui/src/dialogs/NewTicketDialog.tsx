import { type ProjectSnapshot, StatusId } from "@kibo/schema";
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

type Props = { project: ProjectSnapshot; viewer: string; defaults: NewTicketDefaults; onClose: () => void };

export function NewTicketDialog({ project, viewer, defaults, onClose }: Props) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState<StatusId>(defaults.statusId ?? "todo");
  const [failed, setFailed] = useState(false);
  const parent = project.tickets.find((t) => t.id === defaults.parentId);
  const pickStatus = (v: string) => {
    const parsed = StatusId.safeParse(v);
    if (parsed.success) setStatusId(parsed.data);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailed(false);
    try {
      await client.rpc({
        method: "command",
        projectId: project.meta.id,
        command: {
          method: "createTicket",
          title: title.trim(),
          description,
          statusId,
          parentId: defaults.parentId ?? null,
          assignee: { kind: "human", ref: viewer },
        },
        ...(defaults.instanceId && { instanceId: defaults.instanceId }),
      });
    } catch {
      setFailed(true);
      return;
    }
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fr.newTicket.title}</DialogTitle>
            <DialogDescription>
              {fr.newTicket.subtitle(project.meta.name, project.nextTicketKey)}
            </DialogDescription>
          </DialogHeader>
          {parent && (
            <p className="text-sm text-muted-foreground">
              {fr.newTicket.parent} : <span className="font-mono">{parent.key}</span> {parent.title}
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor={`${id}-title`}>{fr.newTicket.name}</Label>
            <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-description`}>{fr.newTicket.description}</Label>
            <Textarea
              id={`${id}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-status`}>{fr.newTicket.status}</Label>
              <Select value={statusId} onValueChange={pickStatus}>
                <SelectTrigger id={`${id}-status`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {project.workflow
                    .filter((s) => s.id !== "blocked")
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <StatusDot statusId={s.id} />
                        {s.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">{fr.newTicket.assignee}</p>
              <p className="flex h-9 items-center text-sm">
                {fr.newTicket.me} ({viewer})
              </p>
            </div>
          </div>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {fr.newTicket.failed}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {fr.newTicket.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
