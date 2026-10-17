import { describe, expect, test } from "bun:test";
import type { Page, ProjectCommand, Ticket } from "@kibo/schema";
import { executeProjectCommand, readProject } from "./commands";
import { createProjectDoc } from "./project";
import { getTicket } from "./tickets";
import { PLANNING_COMPONENT_REF, trackingMigrationCommands } from "./tracking-migration";

const newDoc = () =>
  createProjectDoc({
    id: "p1",
    key: "EMIS",
    name: "Emis",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
  });
type Doc = ReturnType<typeof newDoc>;

const run = (d: Doc, cmd: ProjectCommand) => executeProjectCommand(d, cmd);
const planRef = (id: string) => ({ kind: "import_ref" as const, source: "plan", id });

function rawFeature(d: Doc, title: string, planId: string | null): Ticket {
  const root = run(d, { method: "createTicket", title }) as Ticket;
  if (planId !== null) run(d, { method: "upsertExternalRef", ticketId: root.id, ref: planRef(planId) });
  run(d, { method: "createTicket", title: `${title} · étape`, parentId: root.id });
  run(d, { method: "updateTicket", ticketId: root.id, shortKey: null });
  return root;
}

function emisLike(d: Doc): Map<string, Ticket> {
  const roots = new Map<string, Ticket>();
  for (const id of ["C0", "C1", "C2", "C3", "C4", "C5"]) roots.set(id, rawFeature(d, `Lot ${id}`, id));
  roots.set("free", rawFeature(d, "Sans référence", null));
  roots.set("dashed", rawFeature(d, "Plan à tiret", "C0-2"));
  roots.set("solo", run(d, { method: "createTicket", title: "Seul" }) as Ticket);
  return roots;
}

function idOf(roots: Map<string, Ticket>, name: string): string {
  const root = roots.get(name);
  if (root === undefined) throw new Error(`missing ${name}`);
  return root.id;
}

function migrate(d: Doc): number {
  let passes = 0;
  for (let cmds = trackingMigrationCommands(readProject(d, "2026-10-16")); cmds.length > 0; ) {
    for (const cmd of cmds) run(d, cmd);
    passes += 1;
    if (passes > 3) throw new Error("the migration does not converge");
    cmds = trackingMigrationCommands(readProject(d, "2026-10-16"));
  }
  return passes;
}

describe("tracking migration", () => {
  test("features get the key of their plan, or F<n> by rank, solo tickets none", () => {
    const d = newDoc();
    const roots = emisLike(d);
    const cmds: ProjectCommand[] = trackingMigrationCommands(readProject(d, "2026-10-16")).filter(
      (c) => c.method === "updateTicket",
    );
    expect(cmds).toEqual([
      ...["C0", "C1", "C2", "C3", "C4", "C5"].map((id) => ({
        method: "updateTicket" as const,
        ticketId: idOf(roots, id),
        shortKey: id,
      })),
      { method: "updateTicket", ticketId: idOf(roots, "free"), shortKey: "F1" },
      { method: "updateTicket", ticketId: idOf(roots, "dashed"), shortKey: "F2" },
    ]);
    migrate(d);
    expect(getTicket(d, idOf(roots, "C4")).shortKey).toBe("C4");
    expect(getTicket(d, idOf(roots, "solo")).shortKey).toBeNull();
  });

  test("a plan key already taken, or a key already set, is kept out of the way", () => {
    const d = newDoc();
    const roots = emisLike(d);
    run(d, { method: "updateTicket", ticketId: idOf(roots, "solo"), shortKey: "C1" });
    run(d, { method: "updateTicket", ticketId: idOf(roots, "free"), shortKey: "F1" });
    const keys = trackingMigrationCommands(readProject(d, "2026-10-16")).flatMap((c) =>
      c.method === "updateTicket" ? [c.shortKey] : [],
    );
    expect(keys).toEqual(["C0", "C2", "C3", "C4", "C5", "F2", "F3"]);
  });

  test("a project without a planning component gets a Planning view page, once", () => {
    const d = newDoc();
    expect(trackingMigrationCommands(readProject(d, "2026-10-16"))).toEqual([
      { method: "addPage", title: "Planning", kind: "view" },
    ]);
    expect(migrate(d)).toBe(2);
    const snap = readProject(d, "2026-10-16");
    const page = snap.pages.find((p) => p.title === "Planning");
    expect(snap.instances).toMatchObject([{ pageId: page?.id, component: PLANNING_COMPONENT_REF }]);
    expect(trackingMigrationCommands(snap)).toEqual([]);
  });

  test("a planning instance anywhere is enough, whatever its version", () => {
    const d = newDoc();
    const page = run(d, { method: "addPage", title: "Suivi", kind: "view" }) as Page;
    run(d, { method: "addInstance", pageId: page.id, component: "planning@2.1.0" });
    expect(trackingMigrationCommands(readProject(d, "2026-10-16"))).toEqual([]);
  });

  test("an Emis-like project is fully migrated in two passes, then nothing is left to do", () => {
    const d = newDoc();
    emisLike(d);
    expect(migrate(d)).toBe(2);
    expect(trackingMigrationCommands(readProject(d, "2026-10-16"))).toEqual([]);
  });
});
