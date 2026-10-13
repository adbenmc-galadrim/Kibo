import { afterEach, expect, test } from "bun:test";
import { executeProjectCommand, readProject } from "@kibo/core";
import { FINAL_STATUSES, type IndexedFile, type StatusId } from "@kibo/schema";
import fc from "fast-check";
import { cleanupTmp } from "../agents/git-test-kit";
import { indexedFile, linkWorld, NOW, P, workspaceIndex, wsRun } from "./auto-link.test-helper";

afterEach(cleanupTmp);

const SPACES = ["/w/0", "/w/1", "/w/2", "/w/3"];
const SPECS = ["./a", "../lib/b"];
const NAMES = ["formatDate", "parseDate"];
const PATHS = ["src/lib/a.ts", "src/lib/b.ts"];

const fileArb: fc.Arbitrary<IndexedFile> = fc
  .record({
    path: fc.constantFrom(...PATHS, "src/pages/x.ts"),
    status: fc.constantFrom<IndexedFile["status"][]>("added", "modified"),
    hash: fc.constantFrom("h1", "h2", null),
    exports: fc.subarray(NAMES),
    imports: fc.array(
      fc.record({ spec: fc.constantFrom(...SPECS), names: fc.subarray(NAMES), line: fc.constant(1) }),
      { maxLength: 2 },
    ),
  })
  .map(({ path, ...over }) => indexedFile(path, over));

const probeArb = fc.dictionary(
  fc.constantFrom(...SPECS),
  fc.option(fc.record({ path: fc.constantFrom(...PATHS), added: fc.boolean(), exports: fc.subarray(NAMES) })),
);

const opArb = fc.oneof(
  fc.record({ op: fc.constant("evaluate" as const) }),
  fc.record({ op: fc.constant("cancel" as const), n: fc.nat(5) }),
  fc.record({ op: fc.constant("remove" as const), n: fc.nat(5) }),
  fc.record({
    op: fc.constant("status" as const),
    n: fc.nat(2),
    status: fc.constantFrom<StatusId[]>("todo", "in_progress", "done"),
  }),
);

const worldArb = fc.record({
  ticketOf: fc.array(fc.nat(2), { minLength: 4, maxLength: 4 }),
  otherProject: fc.boolean(),
  files: fc.array(fc.array(fileArb, { maxLength: 3 }), { minLength: 4, maxLength: 4 }),
  probes: fc.array(probeArb, { minLength: 4, maxLength: 4 }),
  ops: fc.array(opArb, { minLength: 1, maxLength: 8 }),
});

test("property (g): only kibo addLink blocks between distinct tickets, never twice, never after a cancel", async () => {
  await fc.assert(
    fc.asyncProperty(worldArb, async (world) => {
      const w = linkWorld({ titles: ["A", "B", "C"] });
      const runs = SPACES.map((_key, i) => {
        const ticket = w.tickets[world.ticketOf[i] ?? 0];
        if (!ticket) throw new Error("ticket expected");
        return w.addRun(`r${i}`, ticket, i === 3 && world.otherProject ? { projectId: "Q" } : {});
      });
      SPACES.forEach((key, i) => {
        const table: Record<string, { path: string; added: boolean; exports: string[] }> = {};
        for (const [spec, found] of Object.entries(world.probes[i] ?? {})) {
          if (found) for (const from of [...PATHS, "src/pages/x.ts"]) table[`${from}|${spec}`] = found;
        }
        w.probeTable[key] = table;
      });
      const indexes = SPACES.map((key, i) => workspaceIndex(key, world.files[i] ?? []));
      const spaces = SPACES.map((key, i) => wsRun(key, runs[i]?.id ?? "", NOW + i));
      let cancels = 0;
      for (const step of world.ops) {
        if (step.op === "evaluate") await w.linker.evaluate(P, indexes, spaces);
        const rows = w.store.autoLink.list(P);
        const row = rows.length > 0 ? rows[("n" in step ? step.n : 0) % rows.length] : undefined;
        if (step.op === "cancel" && row) {
          const before = row.status;
          const after = w.linker.cancel(row.id, { kind: "human", ref: "Adam" });
          if (before === "added" && after.status === "cancelled") cancels++;
        }
        const link = readProject(w.doc).links.find((l) => l.id === row?.linkId);
        if (step.op === "remove" && link)
          executeProjectCommand(w.doc, { method: "removeLink", linkId: link.id });
        const ticket = w.tickets[step.op === "status" ? step.n : 0];
        if (step.op === "status" && ticket) {
          executeProjectCommand(w.doc, { method: "setStatus", ticketId: ticket.id, statusId: step.status });
        }
      }
      const ids = new Set(w.tickets.map((t) => t.id));
      const adds = w.log.filter((l) => l.command.method === "addLink");
      for (const entry of adds) {
        const c = entry.command;
        if (c.method !== "addLink") continue;
        expect(entry).toMatchObject({ projectId: P, meta: { origin: "kibo", instanceId: null } });
        expect(c.type).toBe("blocks");
        expect(c.from).not.toBe(c.to);
        expect(ids.has(c.from) && ids.has(c.to)).toBe(true);
        expect(FINAL_STATUSES.some((s) => s === entry.fromStatus)).toBe(false);
      }
      const pairs = adds.map((l) =>
        l.command.method === "addLink" ? `${l.command.from}>${l.command.to}` : "",
      );
      expect(new Set(pairs).size).toBe(pairs.length);
      const removes = w.log.filter((l) => l.command.method === "removeLink");
      expect(removes.every((l) => l.meta.origin === "user")).toBe(true);
      expect(removes).toHaveLength(cancels);
      expect(w.log.every((l) => l.command.method === "addLink" || l.command.method === "removeLink")).toBe(
        true,
      );
      for (const r of w.runs.filter((run) => run.projectId !== P)) {
        expect(w.store.autoLink.list(P).some((l) => l.ownerRunId === r.id || l.otherRunId === r.id)).toBe(
          false,
        );
      }
      w.store.close();
    }),
    { numRuns: 60 },
  );
});
