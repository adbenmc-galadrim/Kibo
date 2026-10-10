import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_AGENT_MCP_TOOLS } from "@kibo/schema";
import { ticketLaunch } from "./mcp-launch";
import { profile } from "./orchestrator.test-helper";
import { projectLaunch } from "./project-run";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const input = () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-mcp-launch-"));
  dirs.push(home);
  return {
    profile: profile({ allow: ["Bash(bun test *)"] }),
    baseUrl: "http://127.0.0.1:4100",
    runId: "r1",
    runDir: join(home, "runs", "r1"),
    hook: { command: "/k/kibo-hook", args: [] },
    token: "a".repeat(64),
  };
};

const serverEnv = (file: string) => JSON.parse(readFileSync(file, "utf8")).mcpServers.kibo.env;

test("a ticket run reaches its own MCP route with the ticket tools only", () => {
  const launch = ticketLaunch(input());
  expect(launch).toMatchObject({
    allow: ["Bash(bun test *)"],
    deny: [],
    mcpUrl: "http://127.0.0.1:4100/agent-mcp/r1",
    mcpTools: "ticket",
  });
  expect(serverEnv(launch.mcpConfigFile)).toEqual({
    KIBO_MCP_URL: "http://127.0.0.1:4100/agent-mcp/r1",
    KIBO_RUN_TOKEN: "a".repeat(64),
    KIBO_MCP_TOOLS: "ticket",
  });
});

test("a project run announces the project tools to its MCP server", () => {
  const launch = projectLaunch(input());
  expect(launch.mcpTools).toBe("project");
  expect(launch.allow.slice(0, PROJECT_AGENT_MCP_TOOLS.length)).toEqual([...PROJECT_AGENT_MCP_TOOLS]);
  expect(serverEnv(launch.mcpConfigFile)).toMatchObject({ KIBO_MCP_TOOLS: "project" });
});
