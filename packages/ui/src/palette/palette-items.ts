import type { ProjectSnapshot, ProjectSummary, StatusId, TabTarget } from "@kibo/schema";
import { fr } from "../i18n/fr";

export type PaletteGroup = "recents" | "tickets" | "pages" | "projects" | "actions";
export type PaletteFilter = "all" | "tickets" | "pages" | "projects" | "actions";
export const FILTERS: PaletteFilter[] = ["all", "tickets", "pages", "projects", "actions"];

export type PaletteAction =
  | { kind: "newTicket"; projectId: string; parentId: string | null }
  | { kind: "newPage"; projectId: string }
  | { kind: "newProject" }
  | { kind: "toggleTheme" };

export type PaletteItem = {
  id: string;
  group: PaletteGroup;
  label: string;
  keywords: string;
  detail: string | null;
  statusId: StatusId | null;
  color: string | null;
  icon: "ticket" | "page" | "project" | "changes" | "new" | "theme";
  run: { kind: "target"; target: TabTarget } | { kind: "action"; action: PaletteAction };
  ticket: { projectId: string; ticketId: string; key: string } | null;
};
export type PaletteSection = { group: PaletteGroup; items: PaletteItem[]; more: string[] };
export type PaletteContext = {
  projects: ProjectSummary[];
  snapshots: Map<string, ProjectSnapshot>;
  recents: TabTarget[];
  activeProjectId: string | null;
  activeTicketId: string | null;
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

function targets(ctx: PaletteContext): PaletteItem[] {
  const out: PaletteItem[] = [];
  for (const project of ctx.projects) {
    const snapshot = ctx.snapshots.get(project.id);
    out.push({
      ...base,
      id: `project:${project.id}`,
      group: "projects",
      label: project.name,
      keywords: normalize(`${project.name} ${project.key}`),
      color: project.color,
      icon: "project",
      run: { kind: "target", target: { kind: "project", projectId: project.id } },
    });
    for (const page of snapshot?.pages ?? []) {
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
      out.push({
        ...base,
        id: `ticket:${project.id}:${t.id}`,
        group: "tickets",
        label: `${t.key} · ${t.title}`,
        keywords: normalize(`${t.key} ${t.title} ${project.name}`),
        detail: snapshot?.workflow.find((s) => s.id === t.statusId)?.label ?? null,
        statusId: t.statusId,
        icon: "ticket",
        run: { kind: "target", target: { kind: "ticket", projectId: project.id, ticketId: t.id } },
        ticket: { projectId: project.id, ticketId: t.id, key: t.key },
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
  if (project) {
    out.push(
      action("newTicket", fr.palette.newTicket, "new", {
        kind: "action",
        action: { kind: "newTicket", projectId: project.id, parentId: null },
      }),
    );
    if (ticket)
      out.push(
        action("newSubTicket", fr.palette.newSubTicket(ticket.key), "new", {
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
    if (project.folder)
      out.push(
        action("changes", fr.palette.openChanges(project.name), "changes", {
          kind: "target",
          target: { kind: "changes", projectId: project.id, worktree: null },
        }),
      );
  }
  out.push(
    action("newProject", fr.palette.newProject, "new", { kind: "action", action: { kind: "newProject" } }),
  );
  out.push(
    action("theme", fr.palette.toggleTheme, "theme", { kind: "action", action: { kind: "toggleTheme" } }),
  );
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

const ORDER: PaletteGroup[] = ["recents", "tickets", "pages", "projects", "actions"];

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
    i.ticket && normalize(i.ticket.key) === needle ? 0 : i.keywords.startsWith(needle) ? 1 : 2;
  return ORDER.flatMap((group) => {
    const all = matched.filter((i) => i.group === group).sort((a, b) => score(a) - score(b));
    if (all.length === 0) return [];
    const capped = group === "tickets" && filter === "all" ? all.slice(0, TICKET_CAP) : all;
    const more = all.slice(capped.length).flatMap((i) => (i.ticket ? [i.ticket.key] : []));
    return [{ group, items: capped, more }];
  });
}
