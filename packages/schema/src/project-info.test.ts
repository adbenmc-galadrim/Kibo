import { expect, test } from "bun:test";
import type { Binding } from "./integrations";
import { emisSnapshot, viewOf } from "./overview-test-kit";
import { projectInfo, projectRepo } from "./project-info";

const binding: Binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "galadrim/emis", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};

test("the project names itself and its repository from the first pull request", () => {
  expect(projectInfo({ ...emisSnapshot(), bindings: [] }, "2026-10-16")).toEqual({
    id: "emis",
    key: "EMIS",
    name: "Emis",
    color: "#14B8A6",
    description: "Suivi de chantier",
    client: null,
    hasFolder: false,
    repo: "galadrimteam/emis-suivi-chantier",
    today: "2026-10-16",
  });
});

test("a GitHub binding names the repository first", () => {
  expect(projectRepo({ tickets: emisSnapshot().tickets, bindings: [binding] })).toBe("galadrim/emis");
});

test("without binding nor pull request, there is no repository", () => {
  expect(projectRepo({ tickets: [viewOf({ id: "t1", title: "Seul" })], bindings: [] })).toBeNull();
});

test("the project tells whether a repository folder is set, never its path", () => {
  const snapshot = emisSnapshot();
  const info = projectInfo(
    { ...snapshot, meta: { ...snapshot.meta, folder: "/Users/adam/emis" }, bindings: [] },
    "2026-10-16",
  );
  expect(info.hasFolder).toBe(true);
  expect(JSON.stringify(info)).not.toContain("/Users/adam");
});
