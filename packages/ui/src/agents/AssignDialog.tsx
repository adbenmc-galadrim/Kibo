import type {
  AgentProfile,
  AssignPreview,
  Domain,
  ProjectSnapshot,
  TicketView,
  WorkspaceConfig,
} from "@kibo/schema";
import { Alert, AlertDescription } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Bot, TriangleAlert } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { reasonText } from "./format";

type Props = {
  project: ProjectSnapshot | null;
  ticketId: string | null;
  config: WorkspaceConfig | null;
  onClose: () => void;
};

function spaceText(profile: AgentProfile, ticket: TicketView): string {
  if (profile.workspace === "worktree") return fr.assign.newWorktree(ticket.key.toLowerCase());
  return profile.workspace === "repo" ? fr.agents.workspace.repo : fr.agents.workspace.isolated;
}

function Notice({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{text}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {fr.common.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type FormProps = {
  project: ProjectSnapshot;
  ticketId: string | null;
  profiles: AgentProfile[];
  domains: Domain[];
  onClose: () => void;
};

function AssignForm({ project, ticketId, profiles, domains, onClose }: FormProps) {
  const id = useId();
  const open = project.tickets.filter((t) => t.statusId !== "done");
  const [chosenTicket, setChosenTicket] = useState(ticketId ?? open[0]?.id ?? "");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [brief, setBrief] = useState("");
  const [preview, setPreview] = useState<AssignPreview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const ticket = project.tickets.find((t) => t.id === chosenTicket) ?? null;
  const profile = profiles.find((p) => p.id === profileId) ?? null;
  const domain = domains.find((d) => d.id === ticket?.domainId)?.name ?? null;
  const projectId = project.meta.id;

  useEffect(() => {
    if (!chosenTicket || !profileId) return;
    let alive = true;
    setPreview(null);
    setPreviewFailed(false);
    client.rpc({ method: "previewAssign", projectId, ticketId: chosenTicket, profileId }).then(
      (p) => alive && setPreview(p),
      () => alive && setPreviewFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [projectId, chosenTicket, profileId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket || !profile) return;
    setFailed(false);
    try {
      await client.rpc({
        method: "assignAgent",
        projectId,
        ticketId: ticket.id,
        profileId: profile.id,
        brief: brief.trim(),
      });
    } catch {
      setFailed(true);
      return;
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {ticketId && ticket ? fr.assign.title(ticket.key) : fr.assign.launchTitle}
            </DialogTitle>
            {ticket && <DialogDescription>{fr.assign.subtitle(ticket.title, domain)}</DialogDescription>}
          </DialogHeader>
          {!ticketId && (
            <div className="grid gap-2">
              <Label htmlFor={`${id}-ticket`}>{fr.assign.ticket}</Label>
              <Select value={chosenTicket} onValueChange={setChosenTicket}>
                <SelectTrigger id={`${id}-ticket`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {open.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-mono text-xs text-muted-foreground">{t.key}</span>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor={`${id}-profile`}>{fr.assign.profile}</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger id={`${id}-profile`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <Bot aria-hidden />
                    {fr.assign.profileOption(p.name, fr.models[p.model], fr.strategiesShort[p.workspace])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {ticket && ticket.waitingOn.length > 0 && (
            <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <TriangleAlert aria-hidden />
              <AlertDescription className="text-inherit">
                {fr.assign.waiting(ticket.key, ticket.waitingOn.join(", "))}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor={`${id}-brief`}>{fr.assign.brief}</Label>
            <Textarea
              id={`${id}-brief`}
              rows={2}
              value={brief}
              placeholder={fr.assign.briefPlaceholder}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
          {ticket && profile && (
            <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5 rounded-md border bg-muted/30 p-3 text-sm">
              <dt className="text-muted-foreground">{fr.assign.space}</dt>
              <dd>{spaceText(profile, ticket)}</dd>
              <dt className="text-muted-foreground">{fr.assign.permissions}</dt>
              <dd>{profile.permissionMode}</dd>
              <dt className="text-muted-foreground">{fr.assign.guidelines}</dt>
              <dd>
                {preview ? fr.assign.guidelineChain(project.meta.name, domain, preview.guidelines) : "-"}
              </dd>
              <dt className="text-muted-foreground">{fr.assign.queue}</dt>
              <dd className="text-cyan-600 dark:text-cyan-400">
                {preview &&
                  (preview.position === null
                    ? fr.assign.startsNow
                    : fr.assign.entersQueue(reasonText(preview.reason), preview.position))}
              </dd>
            </dl>
          )}
          {previewFailed && (
            <p role="alert" className="text-sm text-destructive">
              {fr.assign.previewFailed}
            </p>
          )}
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {fr.assign.failed}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {fr.common.cancel}
            </Button>
            <Button
              type="submit"
              disabled={!ticket || !profile}
              className="bg-brand-strong text-white hover:bg-brand-strong/90"
            >
              {fr.assign.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignDialog({ project, ticketId, config, onClose }: Props) {
  if (!project) return <Notice title={fr.assign.launchTitle} text={fr.assign.noProject} onClose={onClose} />;
  if (!config) return null;
  if (config.profiles.length === 0) {
    return <Notice title={fr.assign.launchTitle} text={fr.assign.noProfile} onClose={onClose} />;
  }
  return (
    <AssignForm
      project={project}
      ticketId={ticketId}
      profiles={config.profiles}
      domains={config.domains}
      onClose={onClose}
    />
  );
}
