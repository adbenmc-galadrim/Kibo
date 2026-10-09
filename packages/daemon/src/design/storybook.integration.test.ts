import { Database } from "bun:sqlite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type ComponentCall, DesignFrame } from "@kibo/schema";
import { cleanupTmp, git, repo, tmp } from "../agents/git-test-kit";
import { bootEmbedDaemon, type EmbedDaemon } from "../embed/embed-daemon.test-helper";
import { type FakeStorybook, startFakeStorybook } from "../testing/fake-storybook";

const STORY = "screens-home--default";

let sb: FakeStorybook;
let branchSb: FakeStorybook;
let kibo: EmbedDaemon;
let projectId = "";
let instanceId = "";
let worktree = "";

beforeAll(async () => {
  sb = startFakeStorybook();
  sb.addStory(STORY, "Screens", "Home");
  branchSb = startFakeStorybook();
  const folder = await repo();
  worktree = join(tmp(), "feat-x");
  await git(["worktree", "add", "-q", "-b", "feat/x", worktree], folder);
  writeFileSync(join(worktree, ".env"), `STORYBOOK_PORT=${branchSb.port}\n`);
  kibo = await bootEmbedDaemon(`storybook.test=${sb.url}`);
  projectId = await kibo.project(folder);
  await kibo.client.ok({
    method: "updateProject",
    projectId,
    patch: { storybook: { origin: sb.url, portEnv: "STORYBOOK_PORT" } },
  });
  instanceId = await kibo.widget(projectId, "mockup@1.0.0", { frame: [] });
}, 60_000);
afterAll(async () => {
  await kibo.stop();
  sb.stop();
  branchSb.stop();
  cleanupTmp();
});

const request = (call: ComponentCall) => kibo.call(projectId, instanceId, call);
const frame = async (url: string, refresh = false) =>
  DesignFrame.parse(await kibo.client.ok(request({ kind: "design.frame", url, refresh })));
const refused = (url: string) => kibo.client.refused(request({ kind: "design.frame", url, refresh: true }));
const cachedFrames = () => {
  const db = new Database(join(kibo.home, "kibo.db"), { readonly: true });
  try {
    return db.query<{ n: number }, []>("SELECT count(*) AS n FROM design_cache").get()?.n ?? -1;
  } finally {
    db.close();
  }
};
const cacheFiles = () => {
  const dir = join(kibo.home, "cache", "design");
  return existsSync(dir) ? readdirSync(dir) : [];
};

test("a story is an html frame whose relay targets the project storybook, never cached", async () => {
  const shown = await frame(`${sb.url}/?path=/story/${STORY}`);
  expect(shown).toMatchObject({
    provider: "storybook",
    mime: "text/html",
    name: "Screens / Home",
    width: null,
    height: null,
    stale: false,
    reachable: true,
    source: `${sb.url}/?path=/story/${STORY}`,
  });
  expect(shown.url.startsWith(`http://127.0.0.1:${kibo.daemon.sandboxPort}/e/`)).toBe(true);
  const res = await fetch(shown.url);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-security-policy")).toContain(`frame-src ${sb.url};`);
  expect(await res.text()).toContain(`src="${sb.url}/iframe.html?id=${STORY}&amp;viewMode=story"`);
  expect(cachedFrames()).toBe(0);
  expect(cacheFiles()).toEqual([]);
});

test("the project and its worktree are listed as reachable storybook origins", async () => {
  expect(await kibo.client.ok(request({ kind: "design.storybooks" }))).toEqual([
    { label: "Projet", origin: sb.url, branch: null, path: null, reachable: true },
    {
      label: "feat/x",
      origin: branchSb.url,
      branch: "feat/x",
      path: realpathSync(worktree),
      reachable: true,
    },
  ]);
});

test("an offline storybook, an undeclared origin and the shell are refused", async () => {
  expect(await refused("http://localhost:6006/?path=/story/screens-home--default")).toMatchObject({
    code: "INVALID_INPUT",
  });
  expect(
    await kibo.client.refused({
      method: "getDesignFrame",
      url: `${sb.url}/?path=/story/${STORY}`,
      refresh: false,
    }),
  ).toMatchObject({ code: "INVALID_INPUT" });
  sb.offline = true;
  try {
    expect(await refused(`${sb.url}/?path=/story/${STORY}`)).toMatchObject({ code: "REMOTE_UNAVAILABLE" });
  } finally {
    sb.offline = false;
  }
  expect((await frame(`${sb.url}/?path=/story/${STORY}`, true)).reachable).toBe(true);
});
