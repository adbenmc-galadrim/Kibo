import { expect, test } from "bun:test";
import type { Domain, Guideline, ProjectSummary, WorkspaceConfig } from "@kibo/schema";
import { buildTree, chainOf, filesOf, findDomain, nodeKey } from "./domains-tree";

const project = (id: string, name: string): ProjectSummary => ({
  id,
  key: id.toUpperCase(),
  name,
  folder: null,
  color: "#F97316",
  worktree: null,
  storybook: null,
  duplication: null,
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
});

const inProject = (projectId: string) => ({ scope: "project", projectId }) as const;
const domain = (id: string, name: string, owner: Domain["owner"]): Domain => ({
  id,
  name,
  color: "#14B8A6",
  owner,
});
const file = (id: string, owner: Guideline["owner"], path: string): Guideline => ({
  id,
  owner,
  path,
  content: "# x",
});

const config: WorkspaceConfig = {
  domains: [
    domain("secu", "Sécurité", { scope: "workspace" }),
    domain("sync", "Sync", inProject("kibo")),
    domain("ui", "UI", inProject("kibo")),
    domain("secu", "Sécurité", inProject("shared")),
  ],
  guidelines: [
    file("w1", { scope: "workspace" }, "conventions.md"),
    file("w2", { scope: "domain", domainId: "secu", projectId: null }, "securite.md"),
    file("k1", inProject("kibo"), "kibo.md"),
    file("k2", inProject("kibo"), "tests.md"),
    file("sync:sync.md", { scope: "domain", domainId: "sync", projectId: "kibo" }, "sync.md"),
    file("secu:copie.md", { scope: "domain", domainId: "secu", projectId: "shared" }, "copie.md"),
  ],
  domainUsage: { secu: 6 },
  projectDomainUsage: { kibo: { sync: 8 } },
  workspaceName: null,
  workspaceDescription: null,
  workspaceIcon: null,
};

const projects = [project("shared", "Portail"), project("fac", "Facturation"), project("kibo", "Kibo")];

test("the workspace folder holds its own files and its own domains only", () => {
  const { workspace } = buildTree(config, projects, null);
  expect(workspace.files.map((g) => g.id)).toEqual(["w1"]);
  expect(workspace.domains.map((d) => [d.domain.name, d.files.map((g) => g.id)])).toEqual([
    ["Sécurité", ["w2"]],
  ]);
  expect(workspace.count).toBe(1);
});

test("one folder per project, the current one first then by name, counting its domains' files", () => {
  const tree = buildTree(config, projects, "kibo", new Set(["shared"]));
  expect(tree.projects.map((p) => [p.project.name, p.count, p.readOnly])).toEqual([
    ["Kibo", 3, false],
    ["Facturation", 0, false],
    ["Portail", 1, true],
  ]);
  const kibo = tree.projects[0];
  expect(kibo?.files.map((g) => g.id)).toEqual(["k1", "k2"]);
  expect(kibo?.domains.map((d) => [d.domain.name, d.files.length])).toEqual([
    ["Sync", 1],
    ["UI", 0],
  ]);
  expect(tree.projects[2]?.domains.map((d) => d.files.map((g) => g.id))).toEqual([["secu:copie.md"]]);
});

test("a domain id shared by the workspace and a project copy is told apart by its owner", () => {
  const inWorkspace = findDomain(config, { kind: "domain", domainId: "secu", projectId: null });
  const copy = findDomain(config, { kind: "domain", domainId: "secu", projectId: "shared" });
  expect(inWorkspace?.owner).toEqual({ scope: "workspace" });
  expect(copy?.owner).toEqual(inProject("shared"));
  expect(nodeKey({ kind: "domain", domainId: "secu", projectId: null })).not.toBe(
    nodeKey({ kind: "domain", domainId: "secu", projectId: "shared" }),
  );
  expect(filesOf(config, { kind: "domain", domainId: "secu", projectId: "shared" }).map((g) => g.id)).toEqual(
    ["secu:copie.md"],
  );
});

test("the injection chain follows the node", () => {
  expect(chainOf({ kind: "workspace" })).toEqual([{ kind: "workspace" }]);
  expect(chainOf({ kind: "project", projectId: "kibo" })).toEqual([
    { kind: "workspace" },
    { kind: "project", projectId: "kibo" },
  ]);
  const sync = { kind: "domain", domainId: "sync", projectId: "kibo" } as const;
  expect(chainOf(sync)).toEqual([{ kind: "workspace" }, { kind: "project", projectId: "kibo" }, sync]);
  const secu = { kind: "domain", domainId: "secu", projectId: null } as const;
  expect(chainOf(secu)).toEqual([{ kind: "workspace" }, secu]);
});
