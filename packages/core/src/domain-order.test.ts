import { describe, expect, test } from "bun:test";
import { listDomains, listGuidelines } from "./agent-config";
import { domainsMap, guidelinesMap } from "./config-store";
import { createProjectDoc } from "./project";
import { listProjectDomainGuidelines, listProjectDomains, upsertProjectDomain } from "./project-domains";
import { createWorkspaceDoc } from "./workspace";

const color = "#14B8A6";
const project = () =>
  createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
  });

const ids = (list: { id: string }[]) => list.map((d) => d.id);

describe("domain and guideline order", () => {
  test("workspace domains: by name, the id breaking ties, the same on every read", () => {
    const ws = createWorkspaceDoc();
    const named: Record<string, string> = { z: "Auth", m: "Sync", a: "Auth", b: "Écrans" };
    for (const [id, name] of Object.entries(named)) domainsMap(ws).set(id, { id, name, color });
    expect(ids(listDomains(ws))).toEqual(["a", "z", "b", "m"]);
    expect(ids(listDomains(ws))).toEqual(ids(listDomains(ws)));
  });

  test("project domains: by name, the id breaking ties", () => {
    const doc = project();
    upsertProjectDomain(doc, "a", { name: "Zeta", color }, []);
    upsertProjectDomain(doc, "z", { name: "Alpha", color }, []);
    upsertProjectDomain(doc, "b", { name: "Alpha", color }, []);
    expect(ids(listProjectDomains(doc))).toEqual(["b", "z", "a"]);
  });

  test("project domain guidelines follow the domain order, then the path", () => {
    const doc = project();
    const files = (...paths: string[]) => paths.map((path) => ({ path, content: "x" }));
    upsertProjectDomain(doc, "a", { name: "Zeta", color }, files("b.md", "a.md"));
    upsertProjectDomain(doc, "z", { name: "Alpha", color }, files("c.md"));
    expect(ids(listProjectDomainGuidelines(doc))).toEqual(["z:c.md", "a:a.md", "a:b.md"]);
  });

  test("guidelines with the same path are ordered by id", () => {
    const ws = createWorkspaceDoc();
    domainsMap(ws).set("d", { id: "d", name: "Auth", color });
    const owners = {
      g2: { scope: "workspace" },
      g1: { scope: "domain", domainId: "d", projectId: null },
      g0: { scope: "workspace" },
    };
    for (const [id, owner] of Object.entries(owners)) {
      const path = id === "g0" ? "z.md" : "a.md";
      guidelinesMap(ws).set(id, { id, owner, path, content: "x" });
    }
    expect(ids(listGuidelines(ws))).toEqual(["g1", "g2", "g0"]);
  });
});
