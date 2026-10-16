import { expect, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import { createMockSdk } from "@kibo/sdk/mock";
import { buildSections, featureOf, withAncestors } from "./build-tree";
import { ALL_SPRINTS, EMPTY_QUERY, NO_SPRINT } from "./filter-tickets";
import { manifest } from "./index";
import { TODAY, trackingSeed } from "./test-seed";

const NOW = Date.parse(`${TODAY}T14:52:00`);
const snapshot = createMockSdk(manifest, { seed: trackingSeed(NOW), today: TODAY }).snapshot();
const { tickets } = snapshot;
const s42 = snapshot.sprints.find((s) => s.name === "S42")?.id ?? "";
const keys = (ts: { keyLabel: string }[]) => ts.map((t) => t.keyLabel);
const sections = (sprint: string, query = EMPTY_QUERY, mine: string | null = null) =>
  buildSections({ tickets, sprint, query, mine, viewer: "adam" });

test("rows are the steps of the sprint: open by recent activity, done apart, roots without step apart", () => {
  const s = sections(s42);
  expect(keys(s.open)).toEqual(["KIB-14", "KIB-9", "KIB-13", "KIB-10", "KIB-15"]);
  expect(keys(s.done)).toEqual(["KIB-5", "KIB-12", "KIB-8", "KIB-7", "KIB-2", "KIB-3", "KIB-4"]);
  expect(keys(s.loose)).toEqual(["KIB-16"]);
  expect(keys(s.features)).toEqual(["KIB-1", "KIB-6", "KIB-11"]);
  expect(s.tickets).toBe(12);
});

test("features are never rows, nested groups give their own steps, the feature is the root", () => {
  const seed = (run: (cmd: ProjectCommand) => unknown) => {
    const root = run({ method: "createTicket", title: "Fonctionnalité" }) as Ticket;
    const nested = run({ method: "createTicket", title: "Étape à sous-étapes", parentId: root.id }) as Ticket;
    run({ method: "createTicket", title: "Sous-étape", parentId: nested.id });
  };
  const all = createMockSdk(manifest, { seed }).snapshot().tickets;
  const s = buildSections({
    tickets: all,
    sprint: ALL_SPRINTS,
    query: EMPTY_QUERY,
    mine: null,
    viewer: "adam",
  });
  expect(keys(s.open)).toEqual(["KIB-3"]);
  const leaf = all.find((t) => t.keyLabel === "KIB-3");
  if (!leaf) throw new Error("seed");
  expect(featureOf(all)(leaf)?.keyLabel).toBe("KIB-1");
  expect(keys(s.features)).toEqual(["KIB-1"]);
});

test("Ouverts hides the done tickets; a feature keeps its steps and drops the roots without step", () => {
  expect(sections(s42, { ...EMPTY_QUERY, openOnly: true }).done).toEqual([]);
  const f5 = tickets.find((t) => t.keyLabel === "KIB-11")?.id ?? "";
  const one = sections(s42, { ...EMPTY_QUERY, featureId: f5 });
  expect(keys(one.open)).toEqual(["KIB-14", "KIB-13", "KIB-15"]);
  expect(keys(one.done)).toEqual(["KIB-12"]);
  expect(one.loose).toEqual([]);
  expect(one.tickets).toBe(12);
});

test("À planifier and Tous les sprints scope the same way", () => {
  expect(keys(sections(NO_SPRINT).open)).toEqual(["KIB-20"]);
  expect(sections(ALL_SPRINTS).tickets).toBe(14);
  expect(keys(sections(ALL_SPRINTS).features)).toEqual(["KIB-1", "KIB-6", "KIB-11", "KIB-17", "KIB-19"]);
});

test("mine keeps the steps assigned to the viewer", () => {
  expect(sections(s42, EMPTY_QUERY, "adam").tickets).toBe(0);
});

test("withAncestors keeps the selected tickets and every ancestor, nothing else", () => {
  const leaf = tickets.find((t) => t.keyLabel === "KIB-14")?.id ?? "";
  const kept = withAncestors(tickets, [leaf]);
  expect(keys(tickets.filter((t) => kept.has(t.id)))).toEqual(["KIB-11", "KIB-14"]);
});
