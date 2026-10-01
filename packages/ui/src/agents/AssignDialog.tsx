import {
  type AgentProfile,
  type AssignPreview,
  type Domain,
  isInbox,
  type ProjectSnapshot,
  type TicketView,
  type WorkspaceConfig,
} from "@kibo/schema";
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
import { Bot } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frInbox } from "../i18n/fr-inbox";
import { projectDomainsOf } from "../lib/project-domains";
import { KeyRequired } from "../shell/KeyRequired";
import { canEdit } from "../state/access";
import { NoFolderAlert, Notice, needsFolder, spaceText, WaitingAlert } from "./AssignAlerts";
import { reasonText } from "./format";

type Props = {
  project: ProjectSnapshot | null;
  ticketId: string | null;
  config: WorkspaceConfig | null;
  baseBranch?: string;
  onClose: () => void;
  onEditProject?: (projectId: string) => void;
};

const DEFAULT_BASE_BRANCH = "main";

type FormProps = {
  project: ProjectSnapshot;
  ticketId: string | null;
  baseBranch: string;
  profiles: AgentProfile[];
  domains: Domain[];
  onClose: () => void;
  onEditProject?: (projectId: string) => void;
};

const assignable = (t: TicketView) => t.statusId !== "done" && t.key !== null;

function AssignForm({ project, ticketId, baseBranch, profiles, domains, onClose, onEditProject }: FormProps) {
  const id = useId();
  const open = project.tickets.filter(assignable);
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
  const keyed = ticket?.key != null;
  const folderMissing = profile !== null && needsFolder(profile, project);

  useEffect(() => {
    setPreview(null);
    setPreviewFailed(false);
    if (!chosenTicket || !profileId || !keyed || folderMissing) return;
    let alive = true;
    client.rpc({ method: "previewAssign", projectId, ticketId: chosenTicket, profileId }).then(
      (p) => alive && setPreview(p),
      () => alive && setPreviewFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [projectId, chosenTicket, profileId, keyed, folderMissing]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket || !profile || folderMissing) return;
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

  const submitButton = (
    <Button
      type="submit"
      disabled={!ticket || !profile || folderMissing}
      className="bg-brand-strong text-white hover:bg-brand-strong/90"
    >
      {fr.assign.submit}
    </Button>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {ticketId && ticket ? fr.assign.title(ticket.keyLabel) : fr.assign.launchTitle}
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
                      <span className="font-mono text-xs text-muted-foreground">{t.keyLabel}</span>
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
                    {fr.assign.profileOption(
                      p.name,
                      fr.agents.modelNames[p.model],
                      fr.strategiesShort[p.workspace],
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {ticket && ticket.waitingOn.length > 0 && <WaitingAlert project={project} ticket={ticket} />}
          {folderMissing && (
            <NoFolderAlert
              onEditProject={onEditProject && canEdit(project) ? () => onEditProject(projectId) : undefined}
            />
          )}
          <div className="grid gap-2">
            <Label htmlFor={`${id}-brief`}>{fr.assign.brief}</Label>
            <Input
              id={`${id}-brief`}
              value={brief}
              placeholder={fr.assign.briefPlaceholder}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
          {ticket && profile && (
            <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5 rounded-md border bg-muted/30 p-3 text-sm">
              <dt className="text-muted-foreground">{fr.assign.space}</dt>
              <dd>{spaceText(profile, project, ticket, baseBranch)}</dd>
              <dt className="text-muted-foreground">{fr.assign.permissions}</dt>
              <dd>{profile.permissionMode}</dd>
              <dt className="text-muted-foreground">{fr.assign.guidelines}</dt>
              <dd>
                {preview ? fr.assign.guidelineChain(project.meta.name, domain, preview.guidelines) : "-"}
              </dd>
              <dt className="text-muted-foreground">{fr.assign.queue}</dt>
              <dd className={preview ? "text-cyan-600 dark:text-cyan-400" : undefined}>
                {preview
                  ? preview.position === null
                    ? fr.assign.startsNow
                    : fr.assign.entersQueue(reasonText(preview.reason), preview.position)
                  : "-"}
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
            {ticket ? <KeyRequired ticket={ticket}>{submitButton}</KeyRequired> : submitButton}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function hasOpenTicket(project: ProjectSnapshot): boolean {
  return project.tickets.some(assignable);
}

export function AssignDialog({
  project,
  ticketId,
  config,
  baseBranch = DEFAULT_BASE_BRANCH,
  onClose,
  onEditProject,
}: Props) {
  if (!project) return <Notice title={fr.assign.launchTitle} text={fr.assign.noProject} onClose={onClose} />;
  if (isInbox(project.meta.id))
    return <Notice title={fr.assign.launchTitle} text={frInbox.noAgent} onClose={onClose} />;
  if (!config) return null;
  const assignable = config.profiles.filter((p) => !p.system);
  if (assignable.length === 0) {
    return <Notice title={fr.assign.launchTitle} text={fr.assign.noProfile} onClose={onClose} />;
  }
  if (!ticketId && !hasOpenTicket(project)) {
    return <Notice title={fr.assign.launchTitle} text={fr.assign.noTicket} onClose={onClose} />;
  }
  return (
    <AssignForm
      project={project}
      ticketId={ticketId}
      baseBranch={baseBranch}
      profiles={assignable}
      domains={projectDomainsOf(project, config) ?? []}
      onClose={onClose}
      onEditProject={onEditProject}
    />
  );
}
