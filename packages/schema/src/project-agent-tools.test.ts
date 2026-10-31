import { describe, expect, test } from "bun:test";
import { isProjectAgentRequest } from "./project-agent-rpc";
import { TOOL_SPECS } from "./project-agent-tool-specs";
import {
  AgentMcpRequest,
  ListQuestionsInput,
  PROJECT_AGENT_MCP_TOOLS,
  PROJECT_AGENT_TOOLS,
  TOOL_INPUTS,
} from "./project-agent-tools";
import { RpcRequest } from "./rpc";

describe("project agent tools", () => {
  test("eleven project tools, prefixed for the kibo server", () => {
    expect(PROJECT_AGENT_MCP_TOOLS).toHaveLength(11);
    expect(PROJECT_AGENT_TOOLS).toContain("list_sprints");
    expect(TOOL_INPUTS.list_sprints.safeParse({}).success).toBe(true);
    expect(PROJECT_AGENT_MCP_TOOLS.every((name) => name.startsWith("mcp__kibo__"))).toBe(true);
  });

  test("list_tickets accepts only a decimal cursor", () => {
    expect(TOOL_INPUTS.list_tickets.safeParse({ cursor: "abc" }).success).toBe(false);
    expect(TOOL_INPUTS.list_tickets.safeParse({ cursor: "50", status: "done" }).success).toBe(true);
  });

  test("one spec per tool, with required keys among its properties", () => {
    expect(TOOL_SPECS.map((s) => s.name).sort()).toEqual([...PROJECT_AGENT_TOOLS].sort());
    for (const spec of TOOL_SPECS) {
      const properties = Object.keys(Object(spec.inputSchema.properties));
      const required: unknown = spec.inputSchema.required ?? [];
      expect(Array.isArray(required)).toBe(true);
      for (const key of Array.isArray(required) ? required : []) expect(properties).toContain(key);
    }
  });

  test("an MCP request names a project tool and defaults its input", () => {
    expect(AgentMcpRequest.parse({ tool: "project_overview" }).input).toEqual({});
    expect(AgentMcpRequest.safeParse({ tool: "ask_user" }).success).toBe(false);
    expect(AgentMcpRequest.safeParse({ tool: "signal_project" }).success).toBe(false);
    expect(AgentMcpRequest.safeParse({ tool: "skill_review" }).success).toBe(false);
  });

  test("list_questions reads archived questions and filters by recipient", () => {
    expect(ListQuestionsInput.parse({ state: "archived" })).toEqual({ state: "archived" });
    expect(ListQuestionsInput.parse({ recipient: "Client" })).toEqual({ state: "open", recipient: "Client" });
    const spec = TOOL_SPECS.find((s) => s.name === "list_questions");
    expect(Object(Object(spec?.inputSchema.properties).state).enum).toContain("archived");
    expect(Object(spec?.inputSchema.properties).recipient).toBeDefined();
  });

  test("the batch spec describes the question actions, recipient and name", () => {
    const batch = TOOL_SPECS.find((s) => s.name === "propose_batch");
    const actions = Object(Object(batch?.inputSchema.properties).actions);
    const properties = Object(Object(actions.items).properties);
    for (const type of ["updateQuestion", "reopenQuestion", "deleteQuestion", "addRecipient"]) {
      expect(properties.type.enum).toContain(type);
    }
    expect(properties.recipient.description).toBeDefined();
    expect(properties.name.description).toBeDefined();
  });

  test("the project agent RPC is part of the daemon RPC", () => {
    const req = RpcRequest.parse({ method: "decideBatch", projectId: "p", batchId: "b", decision: "apply" });
    expect(isProjectAgentRequest(req)).toBe(true);
    expect(isProjectAgentRequest(RpcRequest.parse({ method: "getSession" }))).toBe(false);
  });
});
