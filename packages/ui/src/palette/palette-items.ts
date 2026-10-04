import {
  type AgentsState,
  isInbox,
  type ProjectMeta,
  type ProjectSnapshot,
  type ProjectSummary,
  Screen,
  type StatusId,
  type TabTarget,
} from "@kibo/schema";
import { fr } from "../i18n/fr";
import { withInbox } from "../lib/inbox";
import { HELP_DIALOGS, type HelpDialog } from "../shell/help-dialogs";
import { helpLabel } from "../shell/help-labels";
import { canEdit } from "../state/access";
import { SCREENS } from "../tabs/screens";

export type PaletteGroup = "recents" | "tickets" | "actions" | "agents" | "pages" | "projects";
export type PaletteFilter = "all" | "tickets" | "pages" | "projects" | "actions" | "agents";
export const FILTERS: PaletteFilter[] = ["all", "tickets", "pages", "projects", "actions", "agents"];

export type PaletteAction =
  | { kind: "newTicket"; projectId: string; parentId: string | null }
  | { kind: "newPage"; projectId: string }
  | { kind: "newProject" }
  | { kind: "toggleTheme" }
  | { kind: "reply"; runId: string }
  | { kind: "assign"; projectId: string; ticketId: string }
  | { kind: HelpDialog };

export type PaletteItem = {
  id: string;
  group: PaletteGroup;
  label: string;
  keywords: string;
  detail: string | null;
  statusId: StatusId | null;
  color: string | null;
  icon:
    | "ticket"
    | "page"
    | "project"
    | "changes"
    | "new"
    | "theme"
    | "reply"
    | "assign"
    | HelpDialog
    | Screen;
  run: { kind: "target"; target: TabTarget } | { kind: "action"; action: PaletteAction };
  ticket: { projectId: string; ticketId: string; keyLabel: string } | null;
};
export type PaletteSection = { group: PaletteGroup; items: PaletteItem[]; more: string[] };
export type PaletteContext = {
  projects: ProjectSummary[];
  snapshots: Map<string, ProjectSnapshot>;
  recents: TabTarget[];
  activeProjectId: string | null;
  activeTicketId: string | null;
  agents: AgentsState | null;
};

const TICKET_CAP = 4;
const targetKey = (t: TabTarget): string =>
  JSON.stringify(Object.entries(t).sort(([a], [b]) => a.localeCompare(b)));
export const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const base = { detail: null, statusId: null, color: null, ticket: null };

function queuePositions(agents: AgentsState | null): Map<string, number> {
  const runs = new Map((agents?.runs ?? []).map((r) => [r.id, r]));
  const positions = new Map<string, number>();
  for (const entry of agents?.queue ?? []) {
    const run = runs.get(entry.runId);
    const key = run?.ticketId ? `${run.projectId}:${run.ticketId}` : null;
    if (key && !positions.has(key)) positions.set(key, entry.position);
  }
  return positions;
}

export function activeTicket(ctx: PaletteContext): PaletteItem["ticket"] {
  if (!ctx.activeProjectId || !ctx.activeTicketId) return null;
  const t = ctx.snapshots.get(ctx.activeProjectId)?.tickets.find((x) => x.id === ctx.activeTicketId);
  return t ? { projectId: ctx.activeProjectId, ticketId: t.id, keyLabel: t.keyLabel } : null;
}

const screenItems = (): PaletteItem[] =>
  Screen.options.map((screen) => ({
    ...base,
    id: `screen:${screen}`,
    group: "pages",
    label: SCREENS[screen].title,
    keywords: normalize(SCREENS[screen].crumbs.join(" ")),
    icon: screen,
    run: { kind: "target", target: { kind: "screen", screen } },
  }));

const projectItem = (project: ProjectMeta): PaletteItem => ({
  ...base,
  id: `project:${project.id}`,
  group: "projects",
  label: project.name,
  keywords: normalize(`${project.name} ${project.key}`),
  color: project.color,
  icon: "project",
  run: { kind: "target", target: { kind: "project", projectId: project.id } },
});

function targets(ctx: PaletteContext): PaletteItem[] {
  const out: PaletteItem[] = screenItems();
  const queued = queuePositions(ctx.agents);
  for (const project of withInbox(ctx.projects, ctx.snapshots)) {
    const snapshot = ctx.snapshots.get(project.id);
    if (!isInbox(project.id)) out.push(projectItem(project));
    for (const page of isInbox(project.id) ? [] : (snapshot?.pages ?? [])) {
      out.push({
        ...base,
        id: `page:${project.id}:${page.id}`,
        group: "pages",
        label: fr.tabs.title(project.name, page.title),
        keywords: normalize(`${page.title} ${project.name}`),
        icon: "page",
        run: { kind: "target", target: { kind: "page", projectId: project.id, pageId: page.id } },
      });
    }
    for (const t of snapshot?.tickets ?? []) {
      const position = queued.get(`${project.id}:${t.id}`);
      out.push({
        ...base,
        id: `ticket:${project.id}:${t.id}`,
        group: "tickets",
        label: `${t.keyLabel} · ${t.title}`,
        keywords: normalize(`${t.keyLabel} ${t.title} ${project.name}`),
        detail:
          position !== undefined
            ? fr.agents.position(position)
            : (snapshot?.workflow.find((s) => s.id === t.statusId)?.label ?? null),
        statusId: t.statusId,
        icon: "ticket",
        run: { kind: "target", target: { kind: "ticket", projectId: project.id, ticketId: t.id } },
        ticket: { projectId: project.id, ticketId: t.id, keyLabel: t.keyLabel },
      });
    }
  }
  return out;
}

function actions(ctx: PaletteContext): PaletteItem[] {
  const project = ctx.projects.find((p) => p.id === ctx.activeProjectId);
  const ticket = project
    ? ctx.snapshots.get(project.id)?.tickets.find((t) => t.id === ctx.activeTicketId)
    : undefined;
  const action = (
    id: string,
    label: string,
    icon: PaletteItem["icon"],
    run: PaletteItem["run"],
  ): PaletteItem => ({
    ...base,
    id: `action:${id}`,
    group: "actions",
    label,
    keywords: normalize(label),
    icon,
    run,
  });
  const out: PaletteItem[] = [];
  const snapshot = project ? ctx.snapshots.get(project.id) : undefined;
  if (project && (!snapshot || canEdit(snapshot))) {
    out.push(
      action("newTicket", fr.palette.newTicket, "new", {
        kind: "action",
        action: { kind: "newTicket", projectId: project.id, parentId: null },
      }),
    );
    if (ticket)
      out.push(
        action("newSubTicket", fr.palette.newSubTicket(ticket.keyLabel), "new", {
          kind: "action",
          action: { kind: "newTicket", projectId: project.id, parentId: ticket.id },
        }),
      );
    out.push(
      action("newPage", fr.palette.newPage, "new", {
        kind: "action",
        action: { kind: "newPage", projectId: project.id },
      }),
    );
  }
  if (project?.folder)
    out.push(
      action("changes", fr.palette.openChanges(project.name), "changes", {
        kind: "target",
        target: { kind: "changes", projectId: project.id, worktree: null },
      }),
    );
  out.push(
    action("newProject", fr.palette.newProject, "new", { kind: "action", action: { kind: "newProject" } }),
  );
  out.push(
    action("theme", fr.palette.toggleTheme, "theme", { kind: "action", action: { kind: "toggleTheme" } }),
  );
  for (const key of HELP_DIALOGS)
    out.push(action(key, helpLabel(key), key, { kind: "action", action: { kind: key } }));
  return out;
}

export function buildItems(ctx: PaletteContext): PaletteItem[] {
  const all = [...targets(ctx), ...actions(ctx)];
  const byKey = new Map(
    all.flatMap((i) => (i.run.kind === "target" ? [[targetKey(i.run.target), i] as const] : [])),
  );
  const recents = ctx.recents.flatMap((r) => {
    const item = byKey.get(targetKey(r));
    return item ? [{ ...item, id: `recent:${item.id}`, group: "recents" as const }] : [];
  });
  return [...recents, ...all];
}

const ORDER: PaletteGroup[] = ["recents", "tickets", "actions", "agents", "pages", "projects"];

export function searchItems(items: PaletteItem[], query: string, filter: PaletteFilter): PaletteSection[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const visible = (group: PaletteGroup) =>
    filter === "all"
      ? tokens.length > 0
        ? group !== "recents"
        : group !== "tickets" && group !== "pages"
      : group === filter;
  const matched = items.filter((i) => visible(i.group) && tokens.every((t) => i.keywords.includes(t)));
  const needle = tokens.join(" ");
  const score = (i: PaletteItem) =>
    i.ticket && normalize(i.ticket.keyLabel) === needle ? 0 : i.keywords.startsWith(needle) ? 1 : 2;
  return ORDER.flatMap((group) => {
    const all = matched.filter((i) => i.group === group).sort((a, b) => score(a) - score(b));
    if (all.length === 0) return [];
    const capped = group === "tickets" && filter === "all" ? all.slice(0, TICKET_CAP) : all;
    const more = all.slice(capped.length).flatMap((i) => (i.ticket ? [i.ticket.keyLabel] : []));
    return [{ group, items: capped, more }];
  });
}
