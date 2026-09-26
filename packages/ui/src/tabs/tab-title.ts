import type { ProjectSnapshot, ProjectSummary, TabTarget } from "@kibo/schema";
import {
  FileCode,
  FolderKanban,
  GitCommitHorizontal,
  LayoutDashboard,
  type LucideIcon,
  Ticket,
} from "lucide-react";
import { fr } from "../i18n/fr";
import { pageIcon } from "../registry";

export type TabDescription = { title: string; icon: LucideIcon; color: string | null; missing: boolean };
export type DescribeContext = { projects: ProjectSummary[]; snapshots: Map<string, ProjectSnapshot> };

const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export function describeTarget(target: TabTarget, ctx: DescribeContext): TabDescription {
  const project = ctx.projects.find((p) => p.id === target.projectId);
  if (!project) return { title: fr.tabs.missingProject, icon: FolderKanban, color: null, missing: true };
  const snapshot = ctx.snapshots.get(target.projectId);
  const color = project.color;
  const titled = (item: string) => fr.tabs.title(project.name, item);
  switch (target.kind) {
    case "project":
      return { title: project.name, icon: FolderKanban, color, missing: false };
    case "changes":
      return { title: titled(fr.tabs.changes), icon: GitCommitHorizontal, color, missing: false };
    case "file":
      return { title: basename(target.path), icon: FileCode, color, missing: false };
    case "page": {
      const page = snapshot?.pages.find((p) => p.id === target.pageId);
      if (!page)
        return {
          title: snapshot ? fr.tabs.missingPage : project.name,
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
          title: snapshot ? fr.tabs.missingTicket : project.name,
          icon: Ticket,
          color,
          missing: !!snapshot,
        };
      return { title: titled(ticket.key), icon: Ticket, color, missing: false };
    }
  }
}
