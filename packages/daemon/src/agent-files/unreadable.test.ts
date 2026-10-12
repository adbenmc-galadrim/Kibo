import { expect, spyOn, test } from "bun:test";
import { chmodSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { discoverAgents } from "./discover";
import { agentText, makeTestHome } from "./test-home.test-helper";

async function withMode<T>(path: string, mode: number, run: () => Promise<T>): Promise<T> {
  chmodSync(path, mode);
  try {
    return await run();
  } finally {
    chmodSync(path, 0o755);
  }
}

test("an agent file without read rights is listed as unreadable and logged", async () => {
  const h = makeTestHome();
  const dir = join(h.claudeHome, "agents");
  h.write(join(dir, "review-pr.md"), agentText("review-pr"));
  const locked = h.write(join(dir, "secret.md"), agentText("secret"));
  const log = spyOn(console, "error").mockImplementation(() => {});
  try {
    const agents = await withMode(locked, 0o000, () => discoverAgents(h.roots, []));
    expect(agents.map((a) => [a.name, a.problem, a.file === null, a.hash === null])).toEqual([
      ["review-pr", null, false, false],
      ["secret", "fichier illisible", true, true],
    ]);
    expect(log).toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

test("an agents folder without rights gives no agent and a log line", async () => {
  const h = makeTestHome();
  const dir = join(h.claudeHome, "agents");
  h.write(join(dir, "review-pr.md"), agentText("review-pr"));
  const log = spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await withMode(dir, 0o000, () => discoverAgents(h.roots, []))).toEqual([]);
    expect(log).toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

test("a broken link and a loop of links never stop the discovery", async () => {
  const h = makeTestHome();
  const dir = join(h.claudeHome, "agents");
  h.write(join(dir, "review-pr.md"), agentText("review-pr"));
  symlinkSync(join(dir, "absent.md"), join(dir, "broken.md"));
  symlinkSync(join(dir, "loop-b.md"), join(dir, "loop-a.md"));
  symlinkSync(join(dir, "loop-a.md"), join(dir, "loop-b.md"));
  const agents = await discoverAgents(h.roots, []);
  expect(agents.find((a) => a.name === "review-pr")?.problem).toBeNull();
  for (const name of ["broken", "loop-a", "loop-b"])
    expect(agents.find((a) => a.name === name)).toMatchObject({ file: null, hash: null });
});
