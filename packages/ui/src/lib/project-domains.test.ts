import { expect, test } from "bun:test";
import { projectDomainsOf } from "./project-domains";

const workspace = { domains: [{ id: "d1", name: "Core", color: "#14B8A6" }] };
const shared = { domains: [{ id: "d2", name: "Intégrations", color: "#8B5CF6" }] };

test("a shared project shows its own domains, a local one the workspace domains", () => {
  expect(projectDomainsOf(shared, workspace)).toEqual(shared.domains);
  expect(projectDomainsOf({}, workspace)).toEqual(workspace.domains);
  expect(projectDomainsOf(undefined, workspace)).toEqual(workspace.domains);
  expect(projectDomainsOf({ domains: [] }, workspace)).toEqual([]);
  expect(projectDomainsOf(undefined, null)).toBeUndefined();
});
