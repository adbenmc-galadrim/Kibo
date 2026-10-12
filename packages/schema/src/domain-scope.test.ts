import { describe, expect, test } from "bun:test";
import { domainsOf } from "./domain-scope";
import { Domain } from "./workspace-config";

const color = "#14B8A6";
const inProject = { scope: "project", projectId: "p1" } as const;

describe("domainsOf", () => {
  const own = Domain.parse({ id: "p", name: "Sync", color, owner: inProject });
  const workspace = [Domain.parse({ id: "w", name: "Sécurité", color })];

  test("a local project sees its domains, then the workspace ones", () => {
    expect(domainsOf({ project: { domains: [own], shared: false }, workspace })).toEqual([own, ...workspace]);
  });

  test("a project copy hides the workspace domain with the same id", () => {
    const copy = Domain.parse({ id: "w", name: "Sécurité (copie)", color, owner: inProject });
    expect(domainsOf({ project: { domains: [copy], shared: false }, workspace })).toEqual([copy]);
  });

  test("a shared project sees its own domains only", () => {
    expect(domainsOf({ project: { domains: [own], shared: true }, workspace })).toEqual([own]);
  });
});
