import { expect, test } from "bun:test";
import { Glob } from "bun";

const REPO_ROOT = new URL("../../../../", import.meta.url).pathname;
const ROOTS = ["packages/ui/src", "packages/sdk/src", "components"];
const AGENT_MARK = /AGENT_ACCENT|variant="agent"/;
const PROJECT_AGENT_FILES = /^packages\/ui\/src\/project-agent\//;

const sources = async (): Promise<string[]> => {
  const found: string[] = [];
  for (const root of ROOTS)
    for await (const path of new Glob(`${root}/**/*.{ts,tsx}`).scan({ cwd: REPO_ROOT }))
      if (!path.includes("node_modules") && !path.includes(".test.")) found.push(path);
  return found;
};

test("AGENT_ACCENT and variant agent only appear in project-agent files", async () => {
  const offenders: string[] = [];
  for (const path of await sources()) {
    if (PROJECT_AGENT_FILES.test(path)) continue;
    if (AGENT_MARK.test(await Bun.file(`${REPO_ROOT}${path}`).text())) offenders.push(path);
  }
  expect(offenders).toEqual([]);
});
