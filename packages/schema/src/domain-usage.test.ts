import { describe, expect, test } from "bun:test";
import { countDomainUsage, domainUsageOf, usageOwner } from "./domain-usage";
import { Domain } from "./workspace-config";

const color = "#14B8A6";
const local = (id: string, domainIds: string[], ticketDomains: (string | null)[]) => ({
  id,
  shared: false,
  domainIds,
  ticketDomains,
});

describe("usageOwner", () => {
  test("the project when it owns the id, else the workspace for a local project, else nobody", () => {
    expect(usageOwner(local("a", ["d"], []), "d")).toEqual({ scope: "project", projectId: "a" });
    expect(usageOwner(local("a", [], []), "d")).toEqual({ scope: "workspace" });
    expect(usageOwner({ ...local("a", [], []), shared: true }, "d")).toBeNull();
  });
});

describe("countDomainUsage", () => {
  test("a project domain counts its own project's tickets only", () => {
    const usage = countDomainUsage([local("a", ["d"], ["d", "d"]), local("b", ["d"], ["d"])]);
    expect(usage).toEqual({ workspace: {}, projects: { a: { d: 2 }, b: { d: 1 } } });
  });

  test("a workspace domain counts the local projects without a domain of the same id", () => {
    const usage = countDomainUsage([
      local("copy", ["secu"], ["secu", "secu"]),
      local("plain", [], ["secu", null]),
      { id: "shared", shared: true, domainIds: [], ticketDomains: ["secu"] },
    ]);
    expect(usage).toEqual({ workspace: { secu: 1 }, projects: { copy: { secu: 2 } } });
  });
});

describe("domainUsageOf", () => {
  const usage = { domainUsage: { secu: 1 }, projectDomainUsage: { copy: { secu: 2 } } };

  test("reads the usage of the domain's owner", () => {
    const workspace = Domain.parse({ id: "secu", name: "Sécurité", color });
    const copy = Domain.parse({ ...workspace, owner: { scope: "project", projectId: "copy" } });
    const other = Domain.parse({ ...workspace, owner: { scope: "project", projectId: "other" } });
    expect(domainUsageOf(usage, workspace)).toBe(1);
    expect(domainUsageOf(usage, copy)).toBe(2);
    expect(domainUsageOf(usage, other)).toBe(0);
  });

  test("a config without project usage still reads the workspace usage", () => {
    const workspace = Domain.parse({ id: "secu", name: "Sécurité", color });
    expect(domainUsageOf({ domainUsage: { secu: 4 } }, workspace)).toBe(4);
  });
});
