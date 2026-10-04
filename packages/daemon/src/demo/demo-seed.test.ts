import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StatusId } from "@kibo/schema";
import { z } from "zod";
import { DEMO_COMPONENT_VERSION, DEMO_LINKS, DEMO_NOTE, DEMO_PAGES, DEMO_TICKETS } from "./demo-seed";

const Versioned = z.object({ version: z.string() });
const REPO_COMPONENTS = join(import.meta.dir, "..", "..", "..", "..", "components");

test("eight tickets with unique refs, valid statuses and known parents", () => {
  expect(DEMO_TICKETS).toHaveLength(8);
  const refs = DEMO_TICKETS.map((t) => t.ref);
  expect(new Set(refs).size).toBe(8);
  for (const t of DEMO_TICKETS) {
    expect(StatusId.safeParse(t.status).success).toBe(true);
    if (t.parent) expect(refs.indexOf(t.parent)).toBeLessThan(refs.indexOf(t.ref));
    expect(t.status === "blocked").toBe(t.blockedReason !== undefined);
  }
  expect(DEMO_TICKETS.filter((t) => t.status === "done")).toHaveLength(2);
});

test("two blocking links between seeded tickets and no self link", () => {
  expect(DEMO_LINKS).toHaveLength(2);
  const refs = DEMO_TICKETS.map((t) => t.ref);
  for (const l of DEMO_LINKS) {
    expect(refs).toContain(l.from);
    expect(refs).toContain(l.to);
    expect(l.from).not.toBe(l.to);
    expect(l.type).toBe("blocks");
  }
});

test("four pages: a dashboard with three widgets and three views", () => {
  expect(DEMO_PAGES.map((p) => [p.title, p.kind, p.components.map((c) => c.id)])).toEqual([
    ["Tableau de bord", "dashboard", ["kanban", "tickets", "notes"]],
    ["Kanban", "view", ["kanban"]],
    ["Graphe", "view", ["graph"]],
    ["Notes", "view", ["notes"]],
  ]);
  expect(DEMO_PAGES[0]?.components.every((c) => c.layout !== undefined)).toBe(true);
  expect(DEMO_NOTE.path).toBe("bienvenue.md");
  expect(DEMO_NOTE.markdown).toContain("# Bienvenue");
});

test("the seeded component version is the version of every builtin manifest used", () => {
  const ids = new Set(DEMO_PAGES.flatMap((p) => p.components.map((c) => c.id)));
  for (const id of ids) {
    const raw: unknown = JSON.parse(readFileSync(join(REPO_COMPONENTS, id, "kibo.component.json"), "utf8"));
    expect(Versioned.parse(raw).version).toBe(DEMO_COMPONENT_VERSION);
  }
});
