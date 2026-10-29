import { expect, test } from "bun:test";
import { INBOX_ID, type ProjectSnapshot } from "@kibo/schema";
import { kiboProject, projectsFixture } from "../lib/fixtures";
import { isHelpDialog } from "../shell/help-dialogs";
import { buildItems, type PaletteContext, searchItems } from "./palette-items";

const kibo = kiboProject();
const model = kibo.tickets[0];
if (!model) throw new Error("fixture without ticket");
const inbox: ProjectSnapshot = {
  ...kibo,
  meta: {
    id: INBOX_ID,
    key: "INB",
    name: "Inbox",
    folder: null,
    color: "#64748B",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  },
  tickets: [{ ...model, id: "i3", key: "INB-3", keyLabel: "INB-3", title: "Appeler le comptable" }],
  links: [],
};
const context: PaletteContext = {
  projects: projectsFixture,
  snapshots: new Map([
    ["kibo", kibo],
    [INBOX_ID, inbox],
  ]),
  recents: [],
  activeProjectId: INBOX_ID,
  activeTicketId: "i3",
};

test("the palette finds INB-n under the inbox name, opening its ticket", () => {
  const tickets = searchItems(buildItems(context), "INB-3", "tickets")[0]?.items ?? [];
  expect(tickets.map((i) => [i.label, i.run])).toEqual([
    [
      "INB-3 · Appeler le comptable",
      { kind: "target", target: { kind: "ticket", projectId: INBOX_ID, ticketId: "i3" } },
    ],
  ]);
  expect(searchItems(buildItems(context), "boite comptable", "tickets")[0]?.items).toHaveLength(1);
});

test("the inbox is never a project, nor offers pages or new pages", () => {
  const items = buildItems(context);
  expect(items.filter((i) => i.group === "projects").map((i) => i.label)).not.toContain("Boîte de réception");
  expect(items.some((i) => i.id.startsWith(`project:${INBOX_ID}`))).toBe(false);
  expect(items.some((i) => i.id === "action:newPage")).toBe(false);
});

test("the help entries are palette actions, in the help menu order", () => {
  const help = buildItems(context).filter((i) => i.run.kind === "action" && isHelpDialog(i.run.action.kind));
  expect(help.map((i) => [i.label, i.run])).toEqual([
    ["Raccourcis clavier", { kind: "action", action: { kind: "shortcutsHelp" } }],
    ["Quoi de neuf", { kind: "action", action: { kind: "whatsNew" } }],
    ["Signaler un problème", { kind: "action", action: { kind: "report" } }],
    ["À propos de Kibo", { kind: "action", action: { kind: "about" } }],
  ]);
  expect(searchItems(buildItems(context), "a propos", "actions")[0]?.items.map((i) => i.label)).toEqual([
    "À propos de Kibo",
  ]);
});

const onKibo = (activeTicketId: string | null): PaletteContext => ({
  ...context,
  activeProjectId: "kibo",
  activeTicketId,
});

test("on a project, the palette opens its project agent", () => {
  const item = buildItems(onKibo(null)).find((i) => i.label === "Agent de projet");
  expect(item?.run).toEqual({ kind: "local", action: { kind: "projectAgent" } });
  expect(searchItems(buildItems(onKibo(null)), "agent projet", "actions")[0]?.items[0]?.label).toBe(
    "Agent de projet",
  );
  expect(buildItems({ ...context, activeProjectId: null }).some((i) => i.label === "Agent de projet")).toBe(
    false,
  );
});

test("on an open ticket, the palette copies its /full-delivery command", () => {
  const item = buildItems(onKibo("t15")).find((i) => i.label.startsWith("Copier"));
  expect(item?.label).toBe("Copier /full-delivery KIB-15");
  expect(item?.run).toEqual({
    kind: "local",
    action: {
      kind: "copyDelivery",
      ticket: {
        key: "KIB-15",
        startable: false,
        waitingOn: ["KIB-12"],
        startReason: null,
      },
    },
  });
  expect(buildItems(onKibo(null)).some((i) => i.label.startsWith("Copier"))).toBe(false);
  expect(buildItems(context).some((i) => i.label.startsWith("Copier"))).toBe(false);
});

test("the palette no longer opens the git changes", () => {
  expect(buildItems(onKibo(null)).some((i) => i.id === "action:changes")).toBe(false);
});
