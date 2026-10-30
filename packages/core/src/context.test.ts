import { expect, test } from "bun:test";
import type { Guideline } from "@kibo/schema";
import { guidelineChain } from "./context";

const g = (id: string, owner: Guideline["owner"], path: string, content = `# ${path}`): Guideline => ({
  id,
  owner,
  path,
  content,
});
const all: Guideline[] = [
  g("1", { scope: "domain", domainId: "core", projectId: null }, "guidelines/core.md"),
  g("2", { scope: "workspace" }, "guidelines/git.md"),
  g("3", { scope: "project", projectId: "p1" }, "guidelines/kibo.md"),
  g("5", { scope: "workspace" }, "guidelines/general.md"),
  g("6", { scope: "domain", domainId: "ui", projectId: null }, "guidelines/ui.md"),
  g("7", { scope: "project", projectId: "p2" }, "guidelines/other.md"),
];

test("the chain keeps what applies, from workspace to domain", () => {
  const chain = guidelineChain(all, { projectId: "p1", domainId: "core" });
  expect(chain.map((x) => x.id)).toEqual(["5", "2", "3", "1"]);
  expect(guidelineChain(all, { projectId: "p1", domainId: null }).map((x) => x.id)).toEqual(["5", "2", "3"]);
});
