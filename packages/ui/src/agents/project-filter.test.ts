import { expect, test } from "bun:test";
import { projectsFixture, runFixture } from "./fixtures";
import { effectiveProject, PROJECT_ALL, projectRuns } from "./project-filter";

const runs = [
  runFixture({ id: "a" }),
  runFixture({ id: "b", projectId: "fac" }),
  runFixture({ id: "c", projectId: null }),
];

test("projectRuns keeps the project's runs, null keeps everything", () => {
  expect(projectRuns(runs, null).map((r) => r.id)).toEqual(["a", "b", "c"]);
  expect(projectRuns(runs, "fac").map((r) => r.id)).toEqual(["b"]);
  expect(projectRuns(runs, "kibo").map((r) => r.id)).toEqual(["a"]);
});

test("effectiveProject resolves the preference, unknown ids mean all", () => {
  expect(effectiveProject(PROJECT_ALL, projectsFixture)).toBeNull();
  expect(effectiveProject("fac", projectsFixture)?.name).toBe("API Facturation");
  expect(effectiveProject("ghost", projectsFixture)).toBeNull();
});
