import type { AgentProfile, ProjectSnapshot, TicketView } from "@kibo/schema";
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
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { frProject } from "../i18n/fr-project";

export function needsFolder(profile: AgentProfile, project: ProjectSnapshot): boolean {
  return profile.workspace !== "isolated" && !project.meta.folder;
}

export function spaceText(
  profile: AgentProfile,
  project: ProjectSnapshot,
  ticket: TicketView,
  baseBranch: string,
): string {
  if (needsFolder(profile, project)) return fr.assign.noFolderSpace;
  if (profile.workspace === "worktree")
    return fr.assign.newWorktree(ticket.keyLabel.toLowerCase(), baseBranch);
  return profile.workspace === "repo" ? fr.agents.workspace.repo : fr.agents.workspace.isolated;
}

export function Notice({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
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

function waitingText(project: ProjectSnapshot, ticket: TicketView): string {
  const deps = ticket.waitingOn.map(
    (label) => project.tickets.find((t) => t.key !== null && t.key === label) ?? label,
  );
  const labels = deps.map((dep) => {
    if (typeof dep === "string") return dep;
    const status = project.workflow.find((s) => s.id === dep.statusId)?.label.toLowerCase();
    return status ? fr.assign.dependency(dep.keyLabel, status) : dep.keyLabel;
  });
  const titles = deps.map((dep) => (typeof dep === "string" ? dep : `« ${dep.title} »`));
  return fr.assign.waiting(ticket.keyLabel, labels.join(", "), titles.join(", "));
}

function WarningAlert({ children }: { children: ReactNode }) {
  return (
    <Alert role="status" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
      <TriangleAlert aria-hidden />
      {children}
    </Alert>
  );
}

export function WaitingAlert({ project, ticket }: { project: ProjectSnapshot; ticket: TicketView }) {
  return (
    <WarningAlert>
      <AlertDescription className="text-inherit">{waitingText(project, ticket)}</AlertDescription>
    </WarningAlert>
  );
}

export function NoFolderAlert({ onEditProject }: { onEditProject?: () => void }) {
  return (
    <WarningAlert>
      <AlertDescription className="text-inherit">
        <p>{fr.assign.noFolder(frProject.edit.folder, fr.nav.editProject)}</p>
        {onEditProject && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 text-foreground"
            onClick={onEditProject}
          >
            {frProject.edit.title}
          </Button>
        )}
      </AlertDescription>
    </WarningAlert>
  );
}
