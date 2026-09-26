import { afterEach, beforeEach, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { openRepo } from "./repo";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";
import { createWorktreeWatch, type WorktreeWatch } from "./worktree-watch";

let fx: GitFixture;
let watch: WorktreeWatch | null;
const changes: { worktree: string; paths: string[] | undefined }[] = [];
const logs: { what: string; error: unknown }[] = [];

beforeEach(() => {
  fx = createGitFixture({ remote: false });
  fx.commit("chore: init", { "README.md": "# kibo\n" });
  changes.length = 0;
  logs.length = 0;
  watch = null;
});
afterEach(() => {
  watch?.stop();
  fx.cleanup();
});

const start = (idleMs = 600_000): WorktreeWatch => {
  watch = createWorktreeWatch({
    idleMs,
    onChange: (_projectId, worktree, paths) => changes.push({ worktree, paths }),
    log: (what) => (error) => logs.push({ what, error }),
  });
  return watch;
};
const handle = async (path: string) => (await openRepo(fx.repo, fx.env)).open(path);
const waitFor = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await Bun.sleep(20);
  return check();
};

test("a deleted project folder releases its watch and is logged once", async () => {
  const w = start();
  await w.touch("p", await handle(fx.repo));
  rmSync(fx.repo, { recursive: true, force: true });
  expect(await waitFor(() => logs.length > 0)).toBe(true);
  await Bun.sleep(1000);
  expect(logs).toEqual([{ what: "worktree disappeared, watch released", error: fx.repo }]);
  expect(changes).toEqual([]);
});

test("a deleted worktree stops being watched until it comes back", async () => {
  const linked = join(fx.dir, "kib-2");
  fx.git("worktree", "add", "-q", "-b", "kib-2", linked);
  const w = start();
  const gone = await handle(linked);
  await w.touch("p", gone);
  rmSync(linked, { recursive: true, force: true });
  await expect(w.touch("p", gone)).rejects.toMatchObject({ code: "GIT_FAILED" });
  await expect(w.touch("p", gone)).rejects.toMatchObject({ code: "GIT_FAILED" });
  expect(logs).toEqual([{ what: "worktree disappeared, watch released", error: linked }]);

  fx.git("worktree", "prune");
  fx.git("worktree", "add", "-q", linked, "kib-2");
  await w.touch("p", await handle(linked));
  await Bun.write(join(linked, "README.md"), "# back\n");
  expect(await waitFor(() => changes.length > 0)).toBe(true);
  expect(changes).toContainEqual({ worktree: linked, paths: ["README.md"] });
  expect(logs).toHaveLength(1);
});

test("the periodic sweep releases a worktree that vanished without any event", async () => {
  const linked = join(fx.dir, "kib-3");
  fx.git("worktree", "add", "-q", "-b", "kib-3", linked);
  const w = start(100);
  await w.touch("p", await handle(linked));
  rmSync(linked, { recursive: true, force: true });
  expect(await waitFor(() => logs.length > 0)).toBe(true);
  expect(logs).toEqual([{ what: "worktree disappeared, watch released", error: linked }]);
});
