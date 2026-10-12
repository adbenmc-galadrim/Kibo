import {
  type AgentSummary,
  type AssignPreview,
  type Domain,
  isInbox,
  KiboError,
  type ProjectSnapshot,
  type ProjectSummary,
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
import { frAgentsPage } from "../i18n/fr-agents-page";
import { frAgentsSkills } from "../i18n/fr-agents-skills";
import { frInbox } from "../i18n/fr-inbox";
import { projectDomainsOf } from "../lib/project-domains";
import { KeyRequired } from "../shell/KeyRequired";
import { canEdit } from "../state/access";
import { NoFolderAlert, Notice, needsFolder, SpaceText, WaitingAlert } from "./AssignAlerts";
import { AssignSession } from "./AssignSession";
import { assignableAgents, isDemoAgent } from "./assignable";
import { modelText, scopeText } from "./catalog/agent-labels";
import { useAgentList } from "./catalog/use-agent-list";
import { reasonText } from "./run-state-text";

type Props = {
  project: ProjectSnapshot | null;
  demo?: boolean;
  ticketId: string | null;
  config: WorkspaceConfig | null;
  projects?: readonly ProjectSummary[];
  onClose: () => void;
  onEditProject?: (projectId: string) => void;
};

type ViewProps = Props & { agents: AgentSummary[] };

type FormProps = {
  projects: readonly ProjectSummary[];
  project: ProjectSnapshot;
  ticketId: string | null;
  agents: AgentSummary[];
  domains: Domain[];
  onClose: () => void;
  onEditProject?: (projectId: string) => void;
};

const t = frAgentsSkills.assign;

const assignable = (t: TicketView) => t.statusId !== "done" && t.key !== null;

function queueText(preview: AssignPreview | null): string {
  if (!preview) return "-";
  if (preview.reason?.kind === "ticket_busy") return frAgentsPage.assign.ticketBusy;
  if (preview.position === null) return t.startsNow;
  return t.entersQueue(reasonText(preview.reason), preview.position);
}

function queueTone(preview: AssignPreview | null): string | undefined {
  if (!preview) return undefined;
  return preview.reason?.kind === "ticket_busy" ? "text-destructive" : "text-cyan-600 dark:text-cyan-400";
}

function AgentOption({ agent, projects }: { agent: AgentSummary; projects: readonly ProjectSummary[] }) {
  if (isDemoAgent(agent)) return <>{frAgentsPage.demo.option}</>;
  return (
    <span className="grid min-w-0 text-left">
      <span className="truncate">{t.agentOption(agent.name, scopeText(agent, projects))}</span>
      <span className="truncate text-xs text-muted-foreground">{agent.description}</span>
    </span>
  );
}

function AssignForm({ projects, project, ticketId, agents, domains, onClose, onEditProject }: FormProps) {
  const id = useId();
  const open = project.tickets.filter(assignable);
  const [chosenTicket, setChosenTicket] = useState(ticketId ?? open[0]?.id ?? "");
  const [profileId, setProfileId] = useState(agents[0]?.ref ?? "");
  const [brief, setBrief] = useState("");
  const [preview, setPreview] = useState<AssignPreview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const ticket = project.tickets.find((t) => t.id === chosenTicket) ?? null;
  const profile = agents.find((p) => p.ref === profileId) ?? null;
  const domain = domains.find((d) => d.id === ticket?.domainId)?.name ?? null;
  const projectId = project.meta.id;
  const keyed = ticket?.key != null;
  const folderMissing = profile !== null && needsFolder(profile, project);
  const busy = preview?.reason?.kind === "ticket_busy";

  useEffect(() => {
    setPreview(null);
    setPreviewFailed(false);
    setFresh(false);
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
    if (!ticket || !profile || folderMissing || busy) return;
    setFailure(null);
    try {
      await client.rpc({
        method: "assignAgent",
        projectId,
        ticketId: ticket.id,
        profileId: profile.ref,
        brief: brief.trim(),
        fresh,
      });
    } catch (err) {
      setFailure(
        err instanceof KiboError && err.code === "CONFLICT" ? frAgentsPage.assign.ticketBusy : t.failed,
      );
      return;
    }
    onClose();
  };

  const submitButton = (
    <Button
      type="submit"
      disabled={!ticket || !profile || folderMissing || busy}
      className="bg-brand-strong text-white hover:bg-brand-strong/90"
    >
      {t.submit}
    </Button>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{ticketId && ticket ? t.title(ticket.keyLabel) : t.launchTitle}</DialogTitle>
            {ticket && <DialogDescription>{t.subtitle(ticket.title, domain)}</DialogDescription>}
          </DialogHeader>
          {!ticketId && (
            <div className="grid gap-2">
              <Label htmlFor={`${id}-ticket`}>{t.ticket}</Label>
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
            <Label htmlFor={`${id}-profile`}>{t.agent}</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger id={`${id}-profile`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((p) => (
                  <SelectItem key={p.ref} value={p.ref}>
                    <Bot aria-hidden />
                    <AgentOption agent={p} projects={projects} />
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
            <Label htmlFor={`${id}-brief`}>{t.brief}</Label>
            <Input
              id={`${id}-brief`}
              value={brief}
              placeholder={t.briefPlaceholder}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
          {ticket && profile && (
            <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5 rounded-md border bg-muted/30 p-3 text-sm">
              <dt className="text-muted-foreground">{t.space}</dt>
              <dd>
                <SpaceText agent={profile} project={project} ticket={ticket} />
              </dd>
              <dt className="text-muted-foreground">{t.model}</dt>
              <dd>{modelText(profile.model)}</dd>
              <dt className="text-muted-foreground">{t.permissions}</dt>
              <dd>{profile.settings.permissionMode}</dd>
              <dt className="text-muted-foreground">{t.guidelines}</dt>
              <dd>{preview ? t.guidelineChain(project.meta.name, domain, preview.guidelines) : "-"}</dd>
              <dt className="text-muted-foreground">{t.queue}</dt>
              <dd className={queueTone(preview)}>{queueText(preview)}</dd>
              {preview && !busy && (
                <AssignSession session={preview.session} fresh={fresh} onFreshChange={setFresh} />
              )}
            </dl>
          )}
          {previewFailed && (
            <p role="alert" className="text-sm text-destructive">
              {t.previewFailed}
            </p>
          )}
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
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

export function AssignDialogView({
  project,
  demo = false,
  ticketId,
  config,
  agents,
  projects = [],
  onClose,
  onEditProject,
}: ViewProps) {
  if (!project) return <Notice title={t.launchTitle} text={t.noProject} onClose={onClose} />;
  if (isInbox(project.meta.id))
    return <Notice title={t.launchTitle} text={frInbox.noAgent} onClose={onClose} />;
  if (!config) return null;
  const assignable = assignableAgents(agents, demo);
  if (assignable.length === 0) {
    return <Notice title={t.launchTitle} text={t.noAgent} onClose={onClose} />;
  }
  if (!ticketId && !hasOpenTicket(project)) {
    return <Notice title={t.launchTitle} text={t.noTicket} onClose={onClose} />;
  }
  return (
    <AssignForm
      projects={projects}
      project={project}
      ticketId={ticketId}
      agents={assignable}
      domains={projectDomainsOf(project, config) ?? []}
      onClose={onClose}
      onEditProject={onEditProject}
    />
  );
}

export function AssignDialog(props: Props) {
  const list = useAgentList(props.project?.meta.id ?? null);
  if (props.project && !isInbox(props.project.meta.id) && list.agents === null) {
    if (!list.failed) return null;
    return <Notice title={t.launchTitle} text={t.loadFailed} onClose={props.onClose} />;
  }
  return <AssignDialogView {...props} agents={list.agents ?? []} />;
}
