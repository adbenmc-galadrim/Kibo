import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALLOW_MAX, PROJECT_AGENT_MCP_TOOLS } from "@kibo/schema";
import { ticketLaunch } from "./mcp-launch";
import { testAgent } from "./orchestrator.test-helper";
import { projectLaunch } from "./project-run";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const input = () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-mcp-launch-"));
  dirs.push(home);
  return {
    agent: testAgent({ allow: ["Bash(bun test *)"] }),
    baseUrl: "http://127.0.0.1:4100",
    runId: "r1",
    runDir: join(home, "runs", "r1"),
    hook: { command: "/k/kibo-hook", args: [] },
    token: "a".repeat(64),
  };
};

const serverEnv = (file: string) => JSON.parse(readFileSync(file, "utf8")).mcpServers.kibo.env;

test("a ticket run reaches its own MCP route with the ticket tools only", () => {
  const launch = ticketLaunch({ ...input(), projectAllow: [] });
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

test("a ticket run gets the agent rules then the project rules, without duplicates", () => {
  const agent = testAgent({ allow: ["Bash(git *)"] });
  const launch = ticketLaunch({ ...input(), agent, projectAllow: ["Bash(pnpm *)", "Bash(git *)"] });
  expect(launch.allow).toEqual(["Bash(git *)", "Bash(pnpm *)"]);
});

test("more rules than allowed once merged fail the launch with the count", () => {
  const rules = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `Bash(${prefix}${i} *)`);
  const agent = testAgent({ allow: rules("a", 26) });
  expect(() => ticketLaunch({ ...input(), agent, projectAllow: rules("p", 25) })).toThrow(
    `INVALID_INPUT: 51 permission rules for the agent and the project, ${ALLOW_MAX} at most`,
  );
});

test("an unsafe project rule fails the launch by name", () => {
  expect(() => ticketLaunch({ ...input(), projectAllow: ["Bash(pnpm *)", "Bash(*)"] })).toThrow(
    "INVALID_INPUT: project rule Bash(*) is unsafe or malformed",
  );
});
