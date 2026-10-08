import {
  type AgentProfile,
  type AssignPreview,
  type Domain,
  isInbox,
  KiboError,
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
import { frAgentsPage } from "../i18n/fr-agents-page";
import { frInbox } from "../i18n/fr-inbox";
import { projectDomainsOf } from "../lib/project-domains";
import { KeyRequired } from "../shell/KeyRequired";
import { canEdit } from "../state/access";
import { NoFolderAlert, Notice, needsFolder, SpaceText, WaitingAlert } from "./AssignAlerts";
import { AssignSession } from "./AssignSession";
import { assignableProfiles, isDemoProfile } from "./demo-profile";
import { reasonText } from "./format";

type Props = {
  project: ProjectSnapshot | null;
  demo?: boolean;
  ticketId: string | null;
  config: WorkspaceConfig | null;
  onClose: () => void;
  onEditProject?: (projectId: string) => void;
};

type FormProps = {
  project: ProjectSnapshot;
  ticketId: string | null;
  profiles: AgentProfile[];
  domains: Domain[];
  onClose: () => void;
  onEditProject?: (projectId: string) => void;
};

const assignable = (t: TicketView) => t.statusId !== "done" && t.key !== null;

function queueText(preview: AssignPreview | null): string {
  if (!preview) return "-";
  if (preview.reason?.kind === "ticket_busy") return frAgentsPage.assign.ticketBusy;
  if (preview.position === null) return fr.assign.startsNow;
  return fr.assign.entersQueue(reasonText(preview.reason), preview.position);
}

function queueTone(preview: AssignPreview | null): string | undefined {
  if (!preview) return undefined;
  return preview.reason?.kind === "ticket_busy" ? "text-destructive" : "text-cyan-600 dark:text-cyan-400";
}

function AssignForm({ project, ticketId, profiles, domains, onClose, onEditProject }: FormProps) {
  const id = useId();
  const open = project.tickets.filter(assignable);
  const [chosenTicket, setChosenTicket] = useState(ticketId ?? open[0]?.id ?? "");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [brief, setBrief] = useState("");
  const [preview, setPreview] = useState<AssignPreview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const ticket = project.tickets.find((t) => t.id === chosenTicket) ?? null;
  const profile = profiles.find((p) => p.id === profileId) ?? null;
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
        profileId: profile.id,
        brief: brief.trim(),
        fresh,
      });
    } catch (err) {
      setFailure(
        err instanceof KiboError && err.code === "CONFLICT"
          ? frAgentsPage.assign.ticketBusy
          : fr.assign.failed,
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
                    {isDemoProfile(p)
                      ? frAgentsPage.demo.option
                      : fr.assign.profileOption(
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
              <dd>
                <SpaceText profile={profile} project={project} ticket={ticket} />
              </dd>
              <dt className="text-muted-foreground">{fr.assign.permissions}</dt>
              <dd>{profile.permissionMode}</dd>
              <dt className="text-muted-foreground">{fr.assign.guidelines}</dt>
              <dd>
                {preview ? fr.assign.guidelineChain(project.meta.name, domain, preview.guidelines) : "-"}
              </dd>
              <dt className="text-muted-foreground">{fr.assign.queue}</dt>
              <dd className={queueTone(preview)}>{queueText(preview)}</dd>
              {preview && !busy && (
                <AssignSession session={preview.session} fresh={fresh} onFreshChange={setFresh} />
              )}
            </dl>
          )}
          {previewFailed && (
            <p role="alert" className="text-sm text-destructive">
              {fr.assign.previewFailed}
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

export function AssignDialog({ project, demo = false, ticketId, config, onClose, onEditProject }: Props) {
  if (!project) return <Notice title={fr.assign.launchTitle} text={fr.assign.noProject} onClose={onClose} />;
  if (isInbox(project.meta.id))
    return <Notice title={fr.assign.launchTitle} text={frInbox.noAgent} onClose={onClose} />;
  if (!config) return null;
  const assignable = assignableProfiles(config.profiles, demo);
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
      profiles={assignable}
      domains={projectDomainsOf(project, config) ?? []}
      onClose={onClose}
      onEditProject={onEditProject}
    />
  );
}
