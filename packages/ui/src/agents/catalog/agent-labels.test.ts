import { expect, test } from "bun:test";
import { agentStatus, modelText, runScopeText, scopeText } from "./agent-labels";

const P = "0b1c2d3e-0000-4000-8000-000000000001";
const projects = [{ id: P, name: "Calculette" }];

test("the scope names the project of a project agent", () => {
  expect(scopeText({ scope: "global", projectId: null }, projects)).toBe("Global");
  expect(scopeText({ scope: "project", projectId: P }, projects)).toBe("Projet · Calculette");
  expect(scopeText({ scope: "project", projectId: "ghost" }, projects)).toBe("Projet · projet inconnu");
  expect(scopeText({ scope: "system", projectId: null }, projects)).toBe("Kibo");
});

test("a run names its scope by the project key", () => {
  expect(runScopeText({ agentScope: "project", projectKey: "BOU" })).toBe("Projet · BOU");
  expect(runScopeText({ agentScope: "global", projectKey: "BOU" })).toBe("Global");
  expect(runScopeText({ agentScope: "system", projectKey: null })).toBe("Kibo");
});

test("a model keeps its own name, an absent one is inherited", () => {
  expect(modelText("fable")).toBe("fable");
  expect(modelText("opus")).toBe("Opus");
  expect(modelText(null)).toBe("hérité (Sonnet)");
  expect(modelText("inherit")).toBe("hérité (Sonnet)");
});

test("the status flags unreadable, shadowed and reserved agents", () => {
  const base = { name: "review-pr", scope: "global" as const, problem: null, shadowedBy: null };
  expect(agentStatus(base)).toBe("ok");
  expect(agentStatus({ ...base, problem: "frontmatter manquant" })).toBe("unreadable");
  expect(agentStatus({ ...base, shadowedBy: `project:${P}:review-pr` })).toBe("shadowed");
  expect(agentStatus({ ...base, name: "kibo-demo" })).toBe("reserved");
  expect(agentStatus({ ...base, name: "kibo-demo", scope: "system" })).toBe("ok");
});
