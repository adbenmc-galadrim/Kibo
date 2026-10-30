import { expect, test } from "bun:test";
import { DEFAULT_PROJECT_AGENT_BODY } from "@kibo/core/agents/compose";
import { PROJECT_AGENT_REF } from "@kibo/schema";
import { projectAgentDefinition, projectAgentSource } from "./definition";

test("la définition de l'agent de projet vient du code et n'a ni skills ni sous-agents", () => {
  const agent = projectAgentDefinition();
  expect(agent.ref).toBe(PROJECT_AGENT_REF);
  expect(agent.scope).toBe("system");
  expect(agent.file?.body).toBe(DEFAULT_PROJECT_AGENT_BODY);
  expect(agent.settings.skills).toEqual({ mode: "list", ids: [] });
  expect(agent.settings.subagents).toEqual([]);
  expect(agent.settings.genericSubagents).toBe(false);
  expect(agent.settings.allSubagents).toBe(false);
  expect(agent.settings.permissionMode).toBe("default");
});

test("the project agent source only knows the project agent", () => {
  const source = projectAgentSource();
  expect(source.agents("p1").map((a) => a.ref)).toEqual([PROJECT_AGENT_REF]);
  expect(source.agentOf(PROJECT_AGENT_REF)?.ref).toBe(PROJECT_AGENT_REF);
  expect(source.agentOf("global:opus")).toBeNull();
});
