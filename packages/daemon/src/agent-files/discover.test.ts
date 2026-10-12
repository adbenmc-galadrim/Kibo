import { expect, spyOn, test } from "bun:test";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { discoverAgents } from "./discover";
import { contentHash } from "./guarded-write";
import { agentText, makeTestHome, OTHER_PROJECT_ID, PROJECT_ID } from "./test-home.test-helper";

const setup = () => {
  const h = makeTestHome();
  const global = join(h.claudeHome, "agents");
  const project = join(h.projectFolder, ".claude", "agents");
  h.write(join(global, "review-pr.md"), agentText("review-pr"));
  h.write(join(global, "kibo-demo.md"), agentText("kibo-demo"));
  h.write(join(global, "broken.md"), "---\nname: broken\n");
  h.write(join(global, "mismatch.md"), agentText("autre"));
  h.write(join(global, "sonnet-dev.md"), agentText("sonnet-dev"));
  h.write(join(global, "sub", "x.md"), agentText("x"));
  h.write(join(global, "notes.txt"), "pas un agent");
  h.write(join(project, "kibo-dev.md"), agentText("kibo-dev"));
  h.write(join(project, "review-pr.md"), agentText("review-pr"));
  h.write(join(project, "kibo-demo.md"), agentText("kibo-demo"));
  const projects = [
    { id: PROJECT_ID, folder: h.projectFolder },
    { id: OTHER_PROJECT_ID, folder: null },
  ];
  return { h, global, project, projects };
};

test("agents are found in the global folder and in each project folder, sorted by scope then name", async () => {
  const { h, projects } = setup();
  const agents = await discoverAgents(h.roots, projects);
  expect(agents.map((a) => a.ref)).toEqual([
    "global:broken",
    "global:mismatch",
    "global:review-pr",
    "global:sonnet-dev",
    `project:${PROJECT_ID}:kibo-demo`,
    `project:${PROJECT_ID}:kibo-dev`,
    `project:${PROJECT_ID}:review-pr`,
    "system:demo",
  ]);
});

test("a readable agent carries its file, hash and path", async () => {
  const { h, global, projects } = setup();
  const review = (await discoverAgents(h.roots, projects)).find((a) => a.ref === "global:review-pr");
  expect(review).toMatchObject({
    scope: "global",
    projectId: null,
    name: "review-pr",
    path: join(global, "review-pr.md"),
    hash: contentHash(agentText("review-pr")),
    problem: null,
    nameWarning: null,
    file: { frontmatter: { name: "review-pr" }, body: "Corps" },
  });
  expect(review?.modifiedAt).toBeGreaterThan(0);
});

test("unreadable, mismatched and reserved files are listed with their problem, never launchable", async () => {
  const { h, projects } = setup();
  const agents = await discoverAgents(h.roots, projects);
  const byRef = (ref: string) => agents.find((a) => a.ref === ref);
  expect(byRef("global:broken")).toMatchObject({ file: null });
  expect(byRef("global:broken")?.problem).toContain("frontmatter");
  expect(byRef("global:mismatch")).toMatchObject({ file: null });
  expect(byRef("global:mismatch")?.problem).toContain("diffèrent");
  expect(byRef(`project:${PROJECT_ID}:kibo-demo`)).toMatchObject({
    file: null,
    problem: "nom réservé, ignoré",
  });
  expect(byRef(`project:${PROJECT_ID}:kibo-dev`)).toMatchObject({ scope: "project", problem: null });
});

test("a kibo-<id> file of the global folder is a Kibo agent", async () => {
  const { h, projects } = setup();
  const demo = (await discoverAgents(h.roots, projects)).find(
    (a) => a.name === "kibo-demo" && a.projectId === null,
  );
  expect(demo).toMatchObject({ scope: "system", ref: "system:demo", nameWarning: null });
});

test("a vague name gets a warning, never a refusal", async () => {
  const { h, projects } = setup();
  const vague = (await discoverAgents(h.roots, projects)).find((a) => a.ref === "global:sonnet-dev");
  expect(vague?.nameWarning).toContain("peu parlant");
  expect(vague?.file).not.toBeNull();
});

test("missing folders give nothing", async () => {
  const h = makeTestHome();
  expect(await discoverAgents(h.roots, [{ id: PROJECT_ID, folder: h.projectFolder }])).toEqual([]);
});

test("a symbolic link is listed as refused and never read", async () => {
  const h = makeTestHome();
  const global = join(h.claudeHome, "agents");
  mkdirSync(global, { recursive: true });
  symlinkSync("/etc/passwd", join(global, "evil.md"));
  const [evil] = await discoverAgents(h.roots, []);
  expect(evil).toMatchObject({
    ref: "global:evil",
    file: null,
    content: null,
    hash: null,
    problem: "lien symbolique refusé",
  });
});

test("a file name that is not a valid agent name is skipped and reported", async () => {
  const h = makeTestHome();
  h.write(join(h.claudeHome, "agents", "Mon Agent.md"), agentText("x"));
  const errors = spyOn(console, "error").mockImplementation(() => undefined);
  expect(await discoverAgents(h.roots, [])).toEqual([]);
  expect(errors).toHaveBeenCalled();
  errors.mockRestore();
});

test("a project whose .claude/agents links outside its folder is ignored and reported", async () => {
  const h = makeTestHome();
  const outside = join(h.root, "ailleurs");
  h.write(join(outside, "fuite.md"), agentText("fuite"));
  mkdirSync(join(h.projectFolder, ".claude"), { recursive: true });
  symlinkSync(outside, join(h.projectFolder, ".claude", "agents"));
  const errors = spyOn(console, "error").mockImplementation(() => undefined);
  expect(await discoverAgents(h.roots, [{ id: PROJECT_ID, folder: h.projectFolder }])).toEqual([]);
  expect(String(errors.mock.calls[0]?.[0])).toContain("ignored");
  errors.mockRestore();
});
