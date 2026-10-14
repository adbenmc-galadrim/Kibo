import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { join } from "node:path";
import { type BackupInfo, DEFAULT_DUPLICATION_SETTINGS, type ProjectSnapshot } from "@kibo/schema";
import { cleanupTmp } from "./agents/git-test-kit";
import {
  assign,
  autoLinksOf,
  briefOf,
  contextsOf,
  finished,
  kindsOf,
  momentsOf,
  overlapsOf,
  release,
  startBoutique,
  until,
  writesOf,
  wrote,
} from "./overlaps/integration.test-helper";
import { agentsOf, snapshotOf, stopDaemons } from "./project-agent/integration.test-helper";

afterEach(async () => {
  await stopDaemons();
  cleanupTmp();
});

const blocks = (snapshot: ProjectSnapshot, from: string | undefined, to: string | undefined) =>
  snapshot.links.find((l) => l.type === "blocks" && l.from === from && l.to === to);

test("two runs: the copy is seen, alerted, factorised, then Kibo links the tickets and never relinks a cancel", async () => {
  const b = await startBoutique();
  const { rpc } = b.stack;
  const projectId = b.project.id;
  const owner = await assign(b, "BOU-12");
  await wrote(b.stack, owner, 2);
  const other = await assign(b, "BOU-15");

  await until(async () =>
    briefOf(b.stack, other).includes("## Travail en cours sur le projet") ? true : undefined,
  );
  const brief = briefOf(b.stack, other);
  expect(brief).toContain(`### ${owner.label}`);
  expect(brief).toContain("src/lib/format.ts");
  expect(brief).toContain("formatDate");

  const opened = await until(async () =>
    (await overlapsOf(rpc, projectId)).find((o) => o.key === "export:formatDate" && o.status === "open"),
  );
  expect(opened).toMatchObject({ key: "export:formatDate", ownerRunId: owner.id, otherRunId: other.id });
  for (const run of [owner, other])
    await until(async () => (kindsOf(await momentsOf(rpc, run.id)).includes("overlap") ? true : undefined));
  await until(async () =>
    contextsOf(b.stack, other).some((c) => c.includes(`est aussi exporté par ${owner.label}`))
      ? true
      : undefined,
  );

  const done = await finished(rpc, other.id);
  expect(done.state).toBe("done");
  const actions = (await momentsOf(rpc, other.id)).flatMap((m) =>
    m.data.kind === "actions" ? m.data.actions.map((a) => a.label) : [],
  );
  expect(actions).toContain("A regardé le travail de `BOU-12`");

  const link = await until(async () => (await autoLinksOf(rpc, projectId)).find((l) => l.status === "added"));
  expect(link).toMatchObject({ reason: "copy", fromTicketKey: "BOU-12", toTicketKey: "BOU-15" });
  expect((await overlapsOf(rpc, projectId, "open")).filter((o) => o.kind !== "file")).toEqual([]);
  expect((await overlapsOf(rpc, projectId)).find((o) => o.id === opened.id)?.status).toBe("resolved");
  const [from, to] = [b.tickets.get("BOU-12")?.id, b.tickets.get("BOU-15")?.id];
  expect(blocks(await snapshotOf(rpc, projectId), from, to)?.id).toBe(link.linkId);
  for (const run of [owner, other])
    await until(async () => (kindsOf(await momentsOf(rpc, run.id)).includes("auto_link") ? true : undefined));
  expect((await agentsOf(rpc)).overlapTotal ?? 0).toBe((await overlapsOf(rpc, projectId, "open")).length);

  const cancelled = await rpc<{ status: string }>({ method: "autoLinks.cancel", id: link.id });
  expect(cancelled.status).toBe("cancelled");
  expect(blocks(await snapshotOf(rpc, projectId), from, to)).toBeUndefined();
  release(b.stack, owner);
  await finished(rpc, owner.id);
  await Bun.sleep(500);
  expect(blocks(await snapshotOf(rpc, projectId), from, to)).toBeUndefined();
  expect((await autoLinksOf(rpc, projectId)).map((l) => l.status)).toEqual(["cancelled"]);

  const backup = await rpc<BackupInfo>({ method: "createBackup", reason: "manual" });
  const copy = new Database(join(b.stack.home, "backups", backup.id, "runs.db"), { readonly: true });
  const count = (table: string) =>
    copy.query<{ n: number }, []>(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n ?? 0;
  expect(count("run_overlaps")).toBeGreaterThan(0);
  expect(count("run_auto_links")).toBe(1);
  copy.close();
}, 90_000);

test("a write by the shell, invisible to the hooks, is found by the sweep at the end of the turn", async () => {
  const b = await startBoutique();
  const owner = await assign(b, "BOU-12");
  await wrote(b.stack, owner, 2);
  const shell = await assign(b, "BOU-16");
  await wrote(b.stack, shell, 1);
  expect(writesOf(b.stack, shell)).toEqual([expect.objectContaining({ bypass: true })]);
  release(b.stack, shell);
  await finished(b.stack.rpc, shell.id);
  const found = await until(async () =>
    (await overlapsOf(b.stack.rpc, b.project.id, "open")).find((o) => o.key === "export:formatDate"),
  );
  expect(found).toMatchObject({ ownerRunId: owner.id, otherRunId: shell.id });
  release(b.stack, owner);
  await finished(b.stack.rpc, owner.id);
}, 90_000);

test("detection off: no overlap is recorded, the work in progress is still in the brief", async () => {
  const b = await startBoutique();
  const duplication = { ...DEFAULT_DUPLICATION_SETTINGS, enabled: false };
  await b.stack.rpc({ method: "updateProject", projectId: b.project.id, patch: { duplication } });
  const owner = await assign(b, "BOU-12");
  await wrote(b.stack, owner, 2);
  const keeper = await assign(b, "BOU-17");
  await finished(b.stack.rpc, keeper.id);
  expect(briefOf(b.stack, keeper)).toContain("## Travail en cours sur le projet");
  expect(contextsOf(b.stack, keeper).filter((c) => c.includes("recouvrement"))).toEqual([]);
  release(b.stack, owner);
  await finished(b.stack.rpc, owner.id);
  await Bun.sleep(300);
  expect(await overlapsOf(b.stack.rpc, b.project.id)).toEqual([]);
  expect(await autoLinksOf(b.stack.rpc, b.project.id)).toEqual([]);
}, 90_000);
