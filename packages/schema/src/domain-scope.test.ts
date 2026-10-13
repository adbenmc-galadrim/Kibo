import { describe, expect, test } from "bun:test";
import { domainsOf, sortDomains } from "./domain-scope";
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

describe("domain order", () => {
  const make = (id: string, name: string, owner?: Domain["owner"]) =>
    Domain.parse({ id, name, color, owner });

  test("the project's domains then the workspace's, each by name with the id breaking ties", () => {
    const zeta = make("p1", "Zeta", inProject);
    const alpha = make("p2", "Alpha", inProject);
    const late = make("w2", "Écrans");
    const early = make("w9", "Auth");
    const twinB = make("wb", "Auth");
    const result = domainsOf({
      project: { domains: [zeta, alpha], shared: false },
      workspace: [late, twinB, early],
    });
    expect(result.map((d) => d.id)).toEqual(["p2", "p1", "w9", "wb", "w2"]);
  });

  test("sortDomains orders by name then id, without touching its input", () => {
    const input = [make("b", "Sync"), make("a", "Sync"), make("c", "Auth")];
    expect(sortDomains(input).map((d) => d.id)).toEqual(["c", "a", "b"]);
    expect(input.map((d) => d.id)).toEqual(["b", "a", "c"]);
  });
});
