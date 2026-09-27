import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CodeEvent, type ProjectMeta, RepoStatus } from "@kibo/schema";
import { LOCAL_CONTEXT, type RpcContext } from "../rpc-extensions";
import { call, createService } from "../service";
import { openStore, type Store } from "../store";
import { type CodeService, createCodeService } from "./code-service";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

let fx: GitFixture;
let home: string;
let store: Store;
let code: CodeService;
let project: ProjectMeta;
const events: CodeEvent[] = [];
const REMOTE: RpcContext = { sessionHash: "remote", remote: true };

beforeEach(() => {
  fx = createGitFixture({ remote: false });
  fx.commit("chore: init", { "README.md": "# kibo\n" });
  home = mkdtempSync(join(tmpdir(), "kibo-code-"));
  store = openStore(home);
  const service = createService(store, { user: "adam" });
  project = call(service, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: fx.repo,
    color: "#F97316",
  });
  events.length = 0;
  code = createCodeService(service, { env: fx.env, prPollMs: 0 });
  code.onChange((e) => events.push(e));
});
afterEach(() => {
  code.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
  fx.cleanup();
});

const start = () => code;
const w = () => ({ projectId: project.id, worktree: fx.repo });
const event = (): CodeEvent => ({ type: "code", projectId: project.id, worktree: fx.repo });

test("discardChanges, stageAll, unstageAll and openInEditor are refused from a remote session", async () => {
  const c = start();
  fx.write("README.md", "# changed\n");
  for (const req of [
    { method: "discardChanges" as const, ...w(), paths: ["README.md"] },
    { method: "stageAll" as const, ...w() },
    { method: "unstageAll" as const, ...w() },
    { method: "openInEditor" as const, ...w(), path: "README.md", line: null },
  ]) {
    await expect(c.handle(req, REMOTE)).rejects.toMatchObject({ code: "FORBIDDEN" });
  }
  expect(readFileSync(join(fx.repo, "README.md"), "utf8")).toBe("# changed\n");
  expect(fx.git("diff", "--cached")).toBe("");
  expect(events).toEqual([]);
});

test("discardChanges runs locally, serialised, and emits a code event", async () => {
  const c = start();
  fx.write("README.md", "# changed\n");
  expect(
    await c.handle({ method: "discardChanges", ...w(), paths: ["README.md"] }, LOCAL_CONTEXT),
  ).toBeNull();
  expect(readFileSync(join(fx.repo, "README.md"), "utf8")).toBe("# kibo\n");
  expect(events).toEqual([event()]);
});

test("stageAll then unstageAll round-trip through the service", async () => {
  const c = start();
  fx.write("new.txt", "n\n");
  await c.handle({ method: "stageAll", ...w() }, LOCAL_CONTEXT);
  expect(RepoStatus.parse(await c.handle({ method: "status", ...w() }, LOCAL_CONTEXT)).files[0]?.area).toBe(
    "staged",
  );
  await c.handle({ method: "unstageAll", ...w() }, LOCAL_CONTEXT);
  expect(RepoStatus.parse(await c.handle({ method: "status", ...w() }, LOCAL_CONTEXT)).files[0]?.area).toBe(
    "unstaged",
  );
});
