import { describe, expect, test } from "bun:test";
import { isProjectAgentRequest } from "./project-agent-rpc";
import { TOOL_SPECS } from "./project-agent-tool-specs";
import {
  AgentMcpRequest,
  PROJECT_AGENT_MCP_TOOLS,
  PROJECT_AGENT_TOOLS,
  TOOL_INPUTS,
} from "./project-agent-tools";
import { RpcRequest } from "./rpc";
import { isProjectRun } from "./run";

describe("project agent tools", () => {
  test("ten MCP tools, prefixed for the kibo server", () => {
    expect(PROJECT_AGENT_MCP_TOOLS).toHaveLength(10);
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
  });

  test("a run of kind project is a project run", () => {
    expect(isProjectRun({ kind: "project" })).toBe(true);
    expect(isProjectRun({ kind: "ticket" })).toBe(false);
  });

  test("the project agent RPC is part of the daemon RPC", () => {
    const req = RpcRequest.parse({ method: "decideBatch", projectId: "p", batchId: "b", decision: "apply" });
    expect(isProjectAgentRequest(req)).toBe(true);
    expect(isProjectAgentRequest(RpcRequest.parse({ method: "getSession" }))).toBe(false);
  });
});
