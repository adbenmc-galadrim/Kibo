import { describe, expect, test } from "bun:test";
import type { Page, ProjectCommand } from "@kibo/schema";
import fc from "fast-check";
import { executeProjectCommand, readProject } from "./commands";
import { OVERVIEW_COMPONENT_REF, OVERVIEW_PAGE_TITLE, overviewMigrationCommands } from "./overview-migration";
import { createProjectDoc } from "./project";

const newDoc = () =>
  createProjectDoc({
    id: "p1",
    key: "SILO",
    name: "Silo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });
type Doc = ReturnType<typeof newDoc>;

const run = (d: Doc, cmd: ProjectCommand) => executeProjectCommand(d, cmd);
const page = (d: Doc, title: string, parentId: string | null = null) =>
  run(d, { method: "addPage", title, kind: "view", parentId }) as Page;
const pending = (d: Doc) => overviewMigrationCommands(readProject(d, "2026-10-16"));

function migrate(d: Doc): number {
  let passes = 0;
  for (let cmds = pending(d); cmds.length > 0; cmds = pending(d)) {
    for (const cmd of cmds) run(d, cmd);
    passes += 1;
    if (passes > 3) throw new Error("the migration does not converge");
  }
  return passes;
}

describe("overview migration", () => {
  test("a project without the page gets an overview view page", () => {
    const d = newDoc();
    page(d, "Tickets");
    expect(OVERVIEW_PAGE_TITLE).toBe("Vue d'ensemble");
    expect(pending(d)).toEqual([{ method: "addPage", title: "Vue d'ensemble", kind: "view" }]);
  });

  test("an empty overview page is moved first, then gets the overview instance", () => {
    const d = newDoc();
    page(d, "Tickets");
    const overview = page(d, OVERVIEW_PAGE_TITLE);
    expect(pending(d)).toEqual([
      { method: "movePage", pageId: overview.id, parentId: null, index: 0 },
      { method: "addInstance", pageId: overview.id, component: "overview@1.0.0" },
    ]);
  });

  test("an empty overview page already first is not moved", () => {
    const d = newDoc();
    const overview = page(d, OVERVIEW_PAGE_TITLE);
    page(d, "Tickets");
    expect(pending(d)).toEqual([
      { method: "addInstance", pageId: overview.id, component: OVERVIEW_COMPONENT_REF },
    ]);
  });

  test("an overview instance anywhere is enough, whatever its version or its place", () => {
    const d = newDoc();
    page(d, "Tickets");
    const suivi = page(d, "Suivi");
    run(d, { method: "addInstance", pageId: suivi.id, component: "overview@2.0.0" });
    expect(pending(d)).toEqual([]);
  });

  test("three passes reach nothing to do, the overview page first with its instance", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("Tickets", "Planning", OVERVIEW_PAGE_TITLE), { maxLength: 4 }),
        fc.boolean(),
        (titles, nested) => {
          const d = newDoc();
          let parent: string | null = null;
          for (const title of titles) {
            const created = page(d, title, nested ? parent : null);
            parent = parent ?? created.id;
          }
          expect(migrate(d)).toBeLessThanOrEqual(2);
          const snap = readProject(d, "2026-10-16");
          const first = snap.pages[0];
          expect(first).toMatchObject({ title: OVERVIEW_PAGE_TITLE, parentId: null });
          expect(snap.instances.filter((i) => i.component === OVERVIEW_COMPONENT_REF)).toMatchObject([
            { pageId: first?.id },
          ]);
        },
      ),
    );
  });
});
