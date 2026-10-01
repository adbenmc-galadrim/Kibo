import { expect, test } from "bun:test";
import { DEFAULT_WORKFLOW, type Link, type ProjectSnapshot, type TicketView } from "@kibo/schema";
import { linkCandidates, linksOf } from "./links";

const t = (n: number, title: string, statusId: TicketView["statusId"] = "todo"): TicketView => ({
  id: `${n}@1`,
  key: `KIB-${n}`,
  pendingSeq: null,
  keyLabel: `KIB-${n}`,
  title,
  description: "",
  statusId,
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
});
const link = (id: string, from: number, to: number, type: Link["type"]): Link => ({
  id,
  from: `${from}@1`,
  to: `${to}@1`,
  type,
});
const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [
    t(5, "Loro", "done"),
    t(12, "Schéma Loro des tickets"),
    t(13, "Sync", "done"),
    t(15, "Kanban"),
    t(16, "Notes"),
    t(20, "Schéma des pages"),
    t(21, "Graph"),
  ],
  links: [
    link("l1", 5, 12, "blocks"),
    link("l2", 13, 12, "blocks"),
    link("l3", 12, 15, "blocks"),
    link("l4", 16, 12, "relates"),
    link("l5", 20, 21, "relates"),
  ],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-22",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};

test("links are grouped from the ticket's point of view, relates being symmetric", () => {
  const links = linksOf(project, "12@1");
  expect(links.blockedBy.map((l) => [l.link.id, l.ticket.keyLabel])).toEqual([
    ["l1", "KIB-5"],
    ["l2", "KIB-13"],
  ]);
  expect(links.blocks.map((l) => l.ticket.keyLabel)).toEqual(["KIB-15"]);
  expect(links.related.map((l) => l.ticket.keyLabel)).toEqual(["KIB-16"]);
  expect(linksOf(project, "16@1").related.map((l) => l.ticket.keyLabel)).toEqual(["KIB-12"]);
  expect(linksOf(project, "21@1")).toEqual({
    blockedBy: [],
    blocks: [],
    related: [{ link: link("l5", 20, 21, "relates"), ticket: t(20, "Schéma des pages") }],
  });
});

test("a link to a missing ticket is ignored", () => {
  const broken = { ...project, links: [...project.links, link("l9", 12, 99, "blocks")] };
  expect(linksOf(broken, "12@1").blocks.map((l) => l.ticket.keyLabel)).toEqual(["KIB-15"]);
});

test("candidates exclude the ticket and its linked tickets, match key or title, key first, 8 at most", () => {
  expect(linkCandidates(project, "12@1", "").map((c) => c.keyLabel)).toEqual(["KIB-20", "KIB-21"]);
  expect(linkCandidates(project, "12@1", "kib-2").map((c) => c.keyLabel)).toEqual(["KIB-20", "KIB-21"]);
  expect(linkCandidates(project, "12@1", "schéma").map((c) => c.keyLabel)).toEqual(["KIB-20"]);
  expect(linkCandidates(project, "21@1", "SCH").map((c) => c.keyLabel)).toEqual(["KIB-12"]);
  const many = {
    ...project,
    tickets: Array.from({ length: 12 }, (_, i) => t(100 + i, `Ticket ${i}`)),
    links: [],
  };
  expect(linkCandidates(many, "100@1", "ticket")).toHaveLength(8);
});
