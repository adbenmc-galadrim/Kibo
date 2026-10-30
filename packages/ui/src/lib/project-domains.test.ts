import { expect, test } from "bun:test";
import { Domain } from "@kibo/schema";
import { projectDomainsOf } from "./project-domains";

const inKibo = { scope: "project", projectId: "p1" } as const;
const workspaceDomain = Domain.parse({ id: "d1", name: "Core", color: "#14B8A6" });
const otherProject = Domain.parse({
  id: "d3",
  name: "Facturation",
  color: "#14B8A6",
  owner: { scope: "project", projectId: "p2" },
});
const own = Domain.parse({ id: "d2", name: "Intégrations", color: "#8B5CF6", owner: inKibo });
const config = { domains: [workspaceDomain, own, otherProject] };

test("a project shows its domains then the workspace ones, never another project's", () => {
  const local = { domains: [own] };
  expect(projectDomainsOf(local, config)).toEqual([own, workspaceDomain]);
  expect(projectDomainsOf({}, config)).toEqual([workspaceDomain]);
  expect(projectDomainsOf(undefined, config)).toEqual([workspaceDomain]);
});

test("nothing is known before the configuration is loaded", () => {
  expect(projectDomainsOf(undefined, null)).toBeUndefined();
});
