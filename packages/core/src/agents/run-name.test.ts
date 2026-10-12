import { expect, test } from "bun:test";
import { runName, scopeLabel } from "./run-name";

test("a run is named after its scope, its agent and its ticket", () => {
  const base = { agentName: "review-pr", ticketKey: "BOU-12" };
  expect(runName({ ...base, agentScope: "project", projectKey: "BOU" })).toBe("bou · review-pr · BOU-12");
  expect(runName({ ...base, agentScope: "global", projectKey: "BOU" })).toBe("global · review-pr · BOU-12");
  expect(
    runName({ agentScope: "system", agentName: "kibo-generateur", projectKey: null, ticketKey: null }),
  ).toBe("kibo · kibo-generateur");
  expect(
    runName({ agentScope: "system", agentName: "kibo-project-agent", projectKey: "BOU", ticketKey: null }),
  ).toBe("bou · kibo-project-agent");
});

test("the scope label is the project key in lower case, global or kibo", () => {
  expect(scopeLabel("project", "BOU")).toBe("bou");
  expect(scopeLabel("global", "BOU")).toBe("global");
  expect(scopeLabel("system", null)).toBe("kibo");
  expect(scopeLabel("system", "DEMO")).toBe("demo");
  expect(scopeLabel("project", null)).toBe("projet");
});
