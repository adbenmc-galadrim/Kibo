import { expect, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type ProjectSnapshot,
  type ProjectSummary,
  type TicketView,
} from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { projectsFixture } from "../lib/fixtures";
import { sprintProject } from "../project-agent/sprint-fixtures";
import { type Host, HostProvider } from "../shell/Host";
import { CommandPalette } from "./CommandPalette";
import { buildItems, type PaletteContext, searchItems } from "./palette-items";

const ticket = (n: number, title: string, statusId: TicketView["statusId"] = "in_progress"): TicketView => ({
  id: `${n}@1`,
  key: `KIB-${n}`,
  pendingSeq: null,
  hold: null,
  keyLabel: `KIB-${n}`,
  title,
  description: "",
  statusId,
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  startReason: null,
  onHold: null,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  updatedAt: null,
  feature: null,
});
const summary: ProjectSummary = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: "/repo",
  color: "#F97316",
  worktree: null,
  storybook: null,
  duplication: null,
  delivery: null,
  tracking: null,
  description: null,
  client: null,
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
};
const snapshot: ProjectSnapshot = {
  meta: summary,
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "1@9", title: "Kanban", kind: "view", parentId: null }],
  tickets: [
    ticket(12, "Schéma Loro des tickets (LoroTree)"),
    ticket(14, "Récepteur de hooks Claude Code"),
    ticket(16, "Moteur de règles déclaratif"),
    ticket(18, "Adaptateur GitHub Issues", "todo"),
    ticket(10, "Watcher git et gh"),
    ticket(11, "Démon : auth par jeton local", "in_review"),
    ticket(2, "Graphe"),
  ],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-19",
  sprints: [],
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};
const context: PaletteContext = {
  projects: [summary],
  snapshots: new Map([["p1", snapshot]]),
  recents: [{ kind: "page", projectId: "p1", pageId: "1@9" }],
  activeProjectId: "p1",
  activeTicketId: "12@1",
};

test("tickets are capped at four with a summary of the others", () => {
  const sections = searchItems(buildItems(context), "kib-1", "all");
  const tickets = sections.find((s) => s.group === "tickets");
  expect(tickets?.items.map((i) => i.label)).toEqual([
    "KIB-12 · Schéma Loro des tickets (LoroTree)",
    "KIB-14 · Récepteur de hooks Claude Code",
    "KIB-16 · Moteur de règles déclaratif",
    "KIB-18 · Adaptateur GitHub Issues",
  ]);
  expect(tickets?.more).toEqual(["KIB-10", "KIB-11"]);
  expect(tickets?.items[0]?.detail).toBe("En cours");
});

test("search ignores accents, the filter narrows groups and lifts the cap", () => {
  expect(
    searchItems(buildItems(context), "recepteur", "all").find((s) => s.group === "tickets")?.items,
  ).toHaveLength(1);
  const onlyTickets = searchItems(buildItems(context), "kib-1", "tickets");
  expect(onlyTickets.map((s) => s.group)).toEqual(["tickets"]);
  expect(onlyTickets[0]?.items).toHaveLength(6);
  expect(searchItems(buildItems(context), "kanban", "all").map((s) => s.group)).toEqual(["pages"]);
});

test("an empty query shows recents, projects and contextual actions", () => {
  const sections = searchItems(buildItems(context), "", "all");
  expect(sections.map((s) => s.group)).toEqual(["recents", "actions", "projects"]);
  expect(sections[0]?.items[0]?.label).toBe("Kibo · Kanban");
  expect(sections[1]?.items.map((i) => i.label)).toEqual([
    "Nouveau ticket",
    "Créer un sous-ticket de KIB-12",
    "Nouvelle page",
    "Agent de projet",
    "Copier /full-delivery KIB-12",
    "Nouveau projet",
    "Basculer le thème (système / clair / sombre)",
    "Raccourcis clavier",
    "Quoi de neuf",
    "Signaler un problème",
    "À propos de Kibo",
  ]);
});

test("Enter opens a target, ⌘Enter opens the ticket sheet, Tab cycles the filter", async () => {
  const opened: unknown[] = [];
  const sheets: string[] = [];
  const actions: unknown[] = [];
  render(
    <CommandPalette
      open
      onOpenChange={() => {}}
      newTab={false}
      context={context}
      onOpenTarget={(t, newTab) => opened.push({ t, newTab })}
      onOpenTicketSheet={(_, id) => sheets.push(id)}
      onAction={(a) => actions.push(a)}
    />,
  );
  const dialog = screen.getByRole("dialog", { name: "Palette de commandes" });
  const input = within(dialog).getByRole("combobox");
  await userEvent.type(input, "kib-12");
  await userEvent.keyboard("{Enter}");
  expect(opened).toEqual([{ t: { kind: "ticket", projectId: "p1", ticketId: "12@1" }, newTab: false }]);
  await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
  expect(sheets).toEqual(["12@1"]);
  await userEvent.clear(input);
  await userEvent.keyboard("{Tab}");
  expect(within(dialog).getByText("Tickets", { selector: "[data-filter]" })).toBeTruthy();
});

test("⌘Enter on a page opens it kept, Enter opens it as a preview", async () => {
  const opened: unknown[] = [];
  render(
    <CommandPalette
      open
      onOpenChange={() => {}}
      newTab={false}
      context={context}
      onOpenTarget={(t, newTab, keep) => opened.push({ t, newTab, keep })}
      onOpenTicketSheet={() => {}}
      onAction={() => {}}
    />,
  );
  const input = within(screen.getByRole("dialog", { name: "Palette de commandes" })).getByRole("combobox");
  await userEvent.type(input, "kanban");
  await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
  await userEvent.keyboard("{Enter}");
  const kanban = opened[0];
  expect(kanban).toMatchObject({ newTab: false, keep: true });
  expect(opened[1]).toEqual({ ...(kanban as object), keep: undefined });
});

function setPlatform(platform: string): () => void {
  const original = navigator.platform;
  Object.defineProperty(navigator, "platform", { value: platform, configurable: true });
  return () => Object.defineProperty(navigator, "platform", { value: original, configurable: true });
}

const renderPalette = () =>
  render(
    <CommandPalette
      open
      onOpenChange={() => {}}
      newTab={false}
      context={context}
      onOpenTarget={() => {}}
      onOpenTicketSheet={() => {}}
      onAction={() => {}}
    />,
  );

test("the sheet hint shows ⌘↵ on macOS and Ctrl+↵ elsewhere", () => {
  const sheetHint = () => screen.getByText("ouvrir dans le volet").querySelector("kbd")?.textContent;
  const restoreMac = setPlatform("MacIntel");
  try {
    const { unmount } = renderPalette();
    expect(sheetHint()).toBe("⌘↵");
    unmount();
  } finally {
    restoreMac();
  }
  const restoreLinux = setPlatform("Linux x86_64");
  try {
    renderPalette();
    expect(sheetHint()).toBe("Ctrl+↵");
  } finally {
    restoreLinux();
  }
});

const paletteWithHost = (opened: unknown[]) => {
  const noop = () => {};
  const host: Host = {
    openTicket: noop,
    openNewTicket: noop,
    openFile: noop,
    openView: noop,
    openTarget: noop,
    openProjectAgent: () => opened.push("agent"),
  };
  render(
    <HostProvider host={host}>
      <CommandPalette
        open
        onOpenChange={noop}
        newTab={false}
        context={context}
        onOpenTarget={noop}
        onOpenTicketSheet={noop}
        onAction={noop}
      />
    </HostProvider>,
  );
  return within(screen.getByRole("dialog", { name: "Palette de commandes" }));
};

test("⌘K « Agent de projet » opens the panel of the current project", async () => {
  const opened: unknown[] = [];
  const dialog = paletteWithHost(opened);
  await userEvent.type(dialog.getByRole("combobox"), "agent de projet");
  await userEvent.keyboard("{Enter}");
  expect(opened).toEqual(["agent"]);
});

test("⌘K « Copier /full-delivery KIB-12 » copies the command of the open ticket", async () => {
  const written: string[] = [];
  const clipboard = navigator.clipboard;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  });
  const dialog = paletteWithHost([]);
  await userEvent.type(dialog.getByRole("combobox"), "copier");
  await userEvent.keyboard("{Enter}");
  await new Promise((r) => setTimeout(r, 0));
  expect(written).toEqual(["/full-delivery KIB-12"]);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
});

test("⌘K « Nouvelle fonctionnalité » opens Planning with the newFeature intent, a sprint opens its sheet", async () => {
  const silo = sprintProject();
  const counts = projectsFixture[0]?.counts;
  if (!counts) throw new Error("fixture without counts");
  const views: string[] = [];
  const intents: (string | undefined)[] = [];
  const sprints: string[] = [];
  const noop = () => {};
  const host: Host = {
    openTicket: noop,
    openNewTicket: noop,
    openFile: noop,
    openView: (id, _project, spotlight) => {
      views.push(id);
      intents.push(spotlight?.kind);
    },
    openTarget: noop,
    openSprint: (id) => sprints.push(id),
  };
  const tracked: PaletteContext = {
    ...context,
    projects: [{ ...silo.meta, counts }],
    snapshots: new Map([[silo.meta.id, silo]]),
    activeProjectId: silo.meta.id,
    activeTicketId: null,
  };
  const { unmount } = render(
    <HostProvider host={host}>
      <CommandPalette
        open
        onOpenChange={noop}
        newTab={false}
        context={tracked}
        onOpenTarget={noop}
        onOpenTicketSheet={noop}
        onAction={noop}
      />
    </HostProvider>,
  );
  const dialog = within(screen.getByRole("dialog", { name: "Palette de commandes" }));
  await userEvent.type(dialog.getByRole("combobox"), "nouvelle fonctionnalite");
  await userEvent.keyboard("{Enter}");
  expect(views).toEqual(["planning"]);
  expect(intents).toEqual(["newFeature"]);
  unmount();
  render(
    <HostProvider host={host}>
      <CommandPalette
        open
        onOpenChange={noop}
        newTab={false}
        context={tracked}
        onOpenTarget={noop}
        onOpenTicketSheet={noop}
        onAction={noop}
      />
    </HostProvider>,
  );
  await userEvent.type(screen.getByRole("combobox"), "S44");
  await userEvent.keyboard("{Enter}");
  expect(sprints).toEqual(["s44"]);
});
