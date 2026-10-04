import { expect, test } from "bun:test";
import { INBOX_ID, type ProjectSnapshot } from "@kibo/schema";
import { kiboProject, projectsFixture } from "../agents/fixtures";
import { isHelpDialog } from "../shell/help-dialogs";
import { agentItems } from "./agent-items";
import { activeTicket, buildItems, type PaletteContext, searchItems } from "./palette-items";

const kibo = kiboProject();
const model = kibo.tickets[0];
if (!model) throw new Error("fixture without ticket");
const inbox: ProjectSnapshot = {
  ...kibo,
  meta: { id: INBOX_ID, key: "INB", name: "Inbox", folder: null, color: "#64748B" },
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
  agents: null,
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

test("an inbox ticket cannot be assigned to an agent from the palette", () => {
  const active = activeTicket(context);
  expect(active?.keyLabel).toBe("INB-3");
  expect(agentItems([], active).some((i) => i.icon === "assign")).toBe(false);
  const onKibo = activeTicket({ ...context, activeProjectId: "kibo", activeTicketId: model.id });
  expect(agentItems([], onKibo).some((i) => i.icon === "assign")).toBe(true);
});

test("the help entries are palette actions, in the help menu order", () => {
  const help = buildItems(context).filter((i) => i.run.kind === "action" && isHelpDialog(i.run.action.kind));
  expect(help.map((i) => [i.label, i.run])).toEqual([
    ["Raccourcis clavier", { kind: "action", action: { kind: "shortcutsHelp" } }],
    ["Didacticiel", { kind: "action", action: { kind: "tutorial" } }],
    ["Quoi de neuf", { kind: "action", action: { kind: "whatsNew" } }],
    ["Signaler un problème", { kind: "action", action: { kind: "report" } }],
    ["À propos de Kibo", { kind: "action", action: { kind: "about" } }],
  ]);
  expect(searchItems(buildItems(context), "a propos", "actions")[0]?.items.map((i) => i.label)).toEqual([
    "À propos de Kibo",
  ]);
});
