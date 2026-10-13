import { describe, expect, test } from "bun:test";
import { ConfigCommand, configTarget, Domain, GuidelineOwner } from "./workspace-config";

const color = "#14B8A6";
const inProject = { scope: "project", projectId: "p1" } as const;

describe("Domain", () => {
  test("an old domain without owner belongs to the workspace", () => {
    expect(Domain.parse({ id: "d1", name: "Core", color })).toEqual({
      id: "d1",
      name: "Core",
      color,
      owner: { scope: "workspace" },
    });
  });

  test("a project domain keeps its project", () => {
    expect(Domain.parse({ id: "d1", name: "Core", color, owner: inProject }).owner).toEqual(inProject);
    expect(Domain.safeParse({ id: "d1", name: "Core", color, owner: { scope: "project" } }).success).toBe(
      false,
    );
  });

  test("a domain guideline without project belongs to a workspace domain", () => {
    expect(GuidelineOwner.parse({ scope: "domain", domainId: "d1" })).toEqual({
      scope: "domain",
      domainId: "d1",
      projectId: null,
    });
    expect(GuidelineOwner.parse({ scope: "domain", domainId: "d1", projectId: "p1" })).toEqual({
      scope: "domain",
      domainId: "d1",
      projectId: "p1",
    });
  });
});

describe("ConfigCommand", () => {
  test("domain commands take an optional owner", () => {
    const domain = { name: "UI", color };
    expect(ConfigCommand.parse({ method: "createDomain", domain })).toEqual({
      method: "createDomain",
      domain,
    });
    expect(ConfigCommand.parse({ method: "createDomain", domain, owner: inProject })).toEqual({
      method: "createDomain",
      domain,
      owner: inProject,
    });
    expect(ConfigCommand.parse({ method: "deleteDomain", domainId: "d1", owner: inProject })).toEqual({
      method: "deleteDomain",
      domainId: "d1",
      owner: inProject,
    });
  });
});

describe("configTarget", () => {
  test("a command runs in the project named by its owner, otherwise in the workspace", () => {
    const domain = { name: "UI", color };
    expect(configTarget({ method: "createDomain", domain, owner: inProject })).toBe("p1");
    expect(configTarget({ method: "createDomain", domain })).toBeNull();
    expect(configTarget({ method: "updateDomain", domainId: "d", patch: {}, owner: inProject })).toBe("p1");
    expect(configTarget({ method: "deleteDomain", domainId: "d", owner: { scope: "workspace" } })).toBeNull();
    expect(configTarget({ method: "deleteDomain", domainId: "d" })).toBeNull();
    const domainOwner = { scope: "domain", domainId: "d", projectId: "p2" } as const;
    expect(configTarget({ method: "updateGuideline", owner: domainOwner, guidelineId: "g" })).toBe("p2");
    expect(
      configTarget({
        method: "removeGuideline",
        owner: { scope: "domain", domainId: "d", projectId: null },
        guidelineId: "g",
      }),
    ).toBeNull();
    expect(configTarget({ method: "addGuideline", owner: inProject, path: "a.md", content: "" })).toBe("p1");
    expect(
      configTarget({ method: "removeGuideline", owner: { scope: "workspace" }, guidelineId: "g" }),
    ).toBeNull();
    expect(configTarget({ method: "updateWorkspace", patch: { name: "x" } })).toBeNull();
  });
});
