import { afterEach, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { DEFAULT_DUPLICATION_SETTINGS } from "@kibo/schema";
import { cleanupTmp, repo } from "./agents/git-test-kit";
import {
  assign,
  contextsOf,
  createProject,
  finished,
  momentsOf,
  overlapsOf,
  REPO_AGENT,
  release,
  startBoutique,
  until,
  wrote,
} from "./overlaps/integration.test-helper";
import { postMcp, runToken, stopDaemons } from "./project-agent/integration.test-helper";

afterEach(async () => {
  await stopDaemons();
  cleanupTmp();
});

test("two runs in the project folder are never compared, the folder and a worktree are", async () => {
  const b = await startBoutique();
  const { rpc } = b.stack;
  const owner = await assign(b, "BOU-12", REPO_AGENT);
  await wrote(b.stack, owner, 2);
  const sameFolder = await assign(b, "BOU-13", REPO_AGENT);
  await finished(rpc, sameFolder.id);
  await Bun.sleep(300);
  expect(await overlapsOf(rpc, b.project.id)).toEqual([]);

  const worktree = await assign(b, "BOU-16");
  await wrote(b.stack, worktree, 1);
  release(b.stack, worktree);
  await finished(rpc, worktree.id);
  const found = await until(async () =>
    (await overlapsOf(rpc, b.project.id, "open")).find((o) => o.key === "export:formatDate"),
  );
  expect(found.ownerWorkspace).toBe(realpathSync(b.folder));
  expect(found.otherRunId).toBe(worktree.id);
  release(b.stack, owner);
  await finished(rpc, owner.id);
}, 90_000);

test("a kept copy asks once at the Stop, stays open, informs the owner, and an ignored key never alerts again", async () => {
  const b = await startBoutique();
  const { rpc } = b.stack;
  const owner = await assign(b, "BOU-12");
  await wrote(b.stack, owner, 2);
  const keeper = await assign(b, "BOU-17");
  await finished(rpc, keeper.id);
  const reminders = (await momentsOf(rpc, keeper.id)).filter(
    (m) => m.data.kind === "reminder" && m.data.reminder === "overlap",
  );
  expect(reminders.length).toBeGreaterThan(0);
  const kept = (await overlapsOf(rpc, b.project.id, "open")).find((o) => o.key === "export:formatDate");
  expect(kept).toMatchObject({ ownerRunId: owner.id, otherRunId: keeper.id });
  expect(kept?.deliveredAt).not.toBeNull();

  release(b.stack, owner);
  await finished(rpc, owner.id);
  expect(contextsOf(b.stack, owner).some((c) => c.includes("reprend ton `formatDate`"))).toBe(true);

  await rpc({ method: "overlaps.ignore", id: kept?.id });
  const again = await assign(b, "BOU-16");
  await wrote(b.stack, again, 1);
  release(b.stack, again);
  await finished(rpc, again.id);
  await Bun.sleep(300);
  const rows = (await overlapsOf(rpc, b.project.id)).filter((o) => o.key === "export:formatDate");
  expect(rows.map((o) => o.status)).toEqual(["ignored"]);
  expect(contextsOf(b.stack, again).some((c) => c.includes("`formatDate` est aussi exporté"))).toBe(false);
}, 90_000);

test("peek_work never reaches another project and refuses paths outside or secret", async () => {
  const b = await startBoutique();
  const { rpc } = b.stack;
  const quai = await createProject(rpc, "Quai", "QU", await repo(), 1);
  const foreign = await assign({ stack: b.stack, ...quai }, "QU-1");
  await finished(rpc, foreign.id);
  const owner = await assign(b, "BOU-12");
  await wrote(b.stack, owner, 2);
  const caller = await assign(b, "BOU-16");
  await wrote(b.stack, caller, 1);
  const peek = async (input: Record<string, unknown>) => {
    const res = await postMcp(b.stack.url, caller.id, runToken(b.stack.home, caller.id), {
      tool: "peek_work",
      input,
    });
    return res.json();
  };
  const notFound = (ref: string) => ({
    ok: false,
    error: { code: "NOT_FOUND", message: `run ${ref} not found in this project` },
  });
  for (const ref of ["BOU-99", "QU-1", foreign.id]) expect(await peek({ run: ref })).toEqual(notFound(ref));
  const duplication = { ...DEFAULT_DUPLICATION_SETTINGS, ignore: ["private/**"] };
  await rpc({ method: "updateProject", projectId: b.project.id, patch: { duplication } });
  for (const path of ["../x", ".env", "private/key.ts"])
    expect(await peek({ run: "BOU-12", path })).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  expect(await peek({ run: "BOU-12", path: "src/lib/format.ts" })).toMatchObject({ ok: true });
  for (const run of [caller, owner]) {
    release(b.stack, run);
    await finished(rpc, run.id);
  }
}, 90_000);
