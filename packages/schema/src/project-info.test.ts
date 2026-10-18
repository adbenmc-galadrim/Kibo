import { expect, test } from "bun:test";
import type { Binding } from "./integrations";
import { siloSnapshot, viewOf } from "./overview-test-kit";
import { projectInfo, projectRepo } from "./project-info";

const binding: Binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "silo-labs/silo-location", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};

test("the project names itself and its repository from the first pull request", () => {
  expect(projectInfo({ ...siloSnapshot(), bindings: [] }, "2026-10-16")).toEqual({
    id: "silo",
    key: "SILO",
    name: "Silo",
    color: "#14B8A6",
    description: "Location de box",
    client: null,
    hasFolder: false,
    repo: "silo-labs/silo-location",
    today: "2026-10-16",
  });
});

test("a GitHub binding names the repository first", () => {
  expect(projectRepo({ tickets: siloSnapshot().tickets, bindings: [binding] })).toBe(
    "silo-labs/silo-location",
  );
});

test("without binding nor pull request, there is no repository", () => {
  expect(projectRepo({ tickets: [viewOf({ id: "t1", title: "Seul" })], bindings: [] })).toBeNull();
});

test("the project tells whether a repository folder is set, never its path", () => {
  const snapshot = siloSnapshot();
  const info = projectInfo(
    { ...snapshot, meta: { ...snapshot.meta, folder: "/Users/adam/silo" }, bindings: [] },
    "2026-10-16",
  );
  expect(info.hasFolder).toBe(true);
  expect(JSON.stringify(info)).not.toContain("/Users/adam");
});
