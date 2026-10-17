import {
  isInbox,
  type ProjectMeta,
  type ProjectSnapshot,
  type ProjectSummary,
  type RunView,
  type TabTarget,
} from "@kibo/schema";
import {
  CalendarRange,
  FileCode,
  FolderKanban,
  GitCommitHorizontal,
  LayoutDashboard,
  type LucideIcon,
  Ticket,
} from "lucide-react";
import { fr } from "../i18n/fr";
import { frTracking } from "../i18n/fr-tracking";
import { displayName, inboxMeta } from "../lib/inbox";
import { pageIcon } from "../registry";
import { SCREENS } from "./screens";

export type TabDescription = { title: string; icon: LucideIcon; color: string | null; missing: boolean };
export type DescribeContext = {
  projects: ProjectSummary[];
  snapshots: Map<string, ProjectSnapshot>;
  runs?: readonly RunView[];
};

const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export function describeTarget(target: TabTarget, ctx: DescribeContext): TabDescription {
  if (target.kind === "screen") {
    const { title, icon } = SCREENS[target.screen];
    return { title, icon, color: null, missing: false };
  }
  if (target.kind === "run") {
    const run = ctx.runs?.find((r) => r.id === target.runId);
    const title = run ? fr.tabs.runTitle(run.label) : fr.tabs.run;
    return { title, icon: SCREENS.agents.icon, color: null, missing: false };
  }
  if (target.kind === "skill")
    return { title: target.skillId, icon: SCREENS.skills.icon, color: null, missing: false };
  const project: ProjectMeta | undefined = isInbox(target.projectId)
    ? inboxMeta()
    : ctx.projects.find((p) => p.id === target.projectId);
  if (!project) return { title: fr.tabs.missingProject, icon: FolderKanban, color: null, missing: true };
  const snapshot = ctx.snapshots.get(target.projectId);
  const color = project.color;
  const titled = (item: string) => fr.tabs.title(displayName(project), item);
  switch (target.kind) {
    case "project":
      return { title: displayName(project), icon: FolderKanban, color, missing: false };
    case "changes":
      return { title: titled(fr.tabs.changes), icon: GitCommitHorizontal, color, missing: false };
    case "file":
      return { title: basename(target.path), icon: FileCode, color, missing: false };
    case "page": {
      const page = snapshot?.pages.find((p) => p.id === target.pageId);
      if (!page)
        return {
          title: snapshot ? fr.tabs.missingPage : displayName(project),
          icon: LayoutDashboard,
          color,
          missing: !!snapshot,
        };
      return {
        title: titled(page.title),
        icon: pageIcon(page, snapshot?.instances ?? []),
        color,
        missing: false,
      };
    }
    case "ticket": {
      const ticket = snapshot?.tickets.find((t) => t.id === target.ticketId);
      if (!ticket)
        return {
          title: snapshot ? fr.tabs.missingTicket : displayName(project),
          icon: Ticket,
          color,
          missing: !!snapshot,
        };
      return { title: titled(ticket.keyLabel), icon: Ticket, color, missing: false };
    }
    case "sprint": {
      const sprint = snapshot?.sprints.find((s) => s.id === target.sprintId);
      if (!sprint)
        return {
          title: snapshot ? frTracking.missingSprint : displayName(project),
          icon: CalendarRange,
          color,
          missing: !!snapshot,
        };
      return { title: titled(sprint.code), icon: CalendarRange, color, missing: false };
    }
  }
}
