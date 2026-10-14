import { expect, test } from "bun:test";
import { EMPTY_DELIVERY, type Guideline, KiboError, type ProjectSnapshot } from "@kibo/schema";
import { testAgent } from "./agents-port.test-helper";
import { memoryAgentSource } from "./neutral-agents";
import { testProject } from "./orchestrator.test-helper";
import { createAgentPreview } from "./preview";

const guidelines: Guideline[] = [
  { id: "g1", owner: { scope: "workspace" }, path: "general.md", content: "# Général" },
  { id: "g2", owner: { scope: "project", projectId: "p1" }, path: "kibo.md", content: "# Kibo" },
];
const reviewPr = testAgent({
  id: "review-pr",
  name: "review-pr",
  model: "fable",
  tools: ["Read"],
  body: "Tu relis les PR.",
  subagents: ["global:livraison"],
  skills: { mode: "list", ids: ["brainstorming"] },
  allow: ["Bash(git *)"],
  addDirs: ["/Users/a/.claude/skills"],
});
const livraison = testAgent({ id: "livraison", name: "livraison", body: "Tu livres." });
const delivery = testAgent({ id: "full-delivery", name: "full-delivery", allSubagents: true });
const source = memoryAgentSource([reviewPr, livraison, delivery]);
const token = "a".repeat(64);

const previewOf = (project: ProjectSnapshot) =>
  createAgentPreview({
    data: {
      agentOf: source.agentOf,
      skills: () => [],
      guidelines: () => guidelines,
      ticketContext: (projectId, ticketId) => {
        const ticket = project.tickets.find((t) => t.id === ticketId);
        if (projectId !== "p1" || !ticket) throw new KiboError("NOT_FOUND", `ticket ${ticketId} not found`);
        return { project, ticket, domain: null, childCount: 0 };
      },
    },
    project: () => project,
    workspaceGuidelines: () => guidelines.filter((g) => g.owner.scope === "workspace"),
  });
const preview = previewOf(testProject);

test("the preview shows each level, the composed prompt, the ticket brief, agents.json and the command", async () => {
  const result = await preview({ ref: "global:review-pr", projectId: "p1", ticketId: "t3" });
  expect(result.levels.map(({ label, path }) => ({ label, path }))).toEqual([
    { label: "Workspace", path: "context/1-workspace/general.md" },
    { label: "Projet", path: "context/2-projet/kibo.md" },
    { label: "Agent · review-pr", path: "context/4-agent/review-pr.md" },
  ]);
  expect(result.levels.every((l) => l.tokens > 0)).toBe(true);
  expect(result.systemPrompt).toContain("## agent · review-pr");
  expect(result.brief).toContain("# KIB-3 · Ticket KIB-3");
  expect(JSON.parse(result.agentsJson)).toHaveProperty("livraison");
  expect(result.command).toEqual({
    model: "fable",
    permissionMode: "acceptEdits",
    tools: ["Read"],
    disallowedTools: null,
    allow: ["Bash(git *)", "Skill(brainstorming)"],
    allowOrigins: [
      { rule: "Bash(git *)", origin: "agent" },
      { rule: "Skill(brainstorming)", origin: "agent" },
    ],
    addDirs: [{ dir: "/Users/a/.claude/skills", origin: "agent" }],
    subagents: ["livraison"],
    allSubagents: false,
    skills: { mode: "list", ids: ["brainstorming"] },
  });
  const text = JSON.stringify(result);
  expect(text.includes("KIBO_RUN_TOKEN")).toBe(false);
  expect(text.includes(token)).toBe(false);
});

test("without a ticket the brief is the example ticket, without a project only the workspace applies", async () => {
  const example = await preview({ ref: "global:review-pr", projectId: "p1" });
  expect(example.brief).toContain("KIB-0 · Ticket d'exemple");
  const machine = await preview({ ref: "global:livraison" });
  expect(machine.levels.map((l) => l.label)).toEqual(["Workspace", "Agent · livraison"]);
  expect(machine.brief).toBe("");
  expect(machine.agentsJson).toBe("{}");
});

test("an unknown agent is AGENT_NOT_FOUND", async () => {
  await expect(preview({ ref: "global:absent" })).rejects.toThrow("AGENT_NOT_FOUND");
});

test("the preview shows the work in progress of two example runs and the parallel work rules", async () => {
  for (const req of [{ projectId: "p1" }, { projectId: "p1", ticketId: "t3" }]) {
    const result = await preview({ ref: "global:review-pr", ...req });
    expect(result.brief).toContain("## Travail en cours sur le projet");
    expect(result.brief).toContain("### kib · livraison · KIB-1");
    expect(result.brief).toContain("### kib · livraison · KIB-2");
    expect(result.brief).toContain("**Recouvrements ouverts avec toi**");
    expect(result.systemPrompt).toContain("## Travail en parallèle");
  }
  const machine = await preview({ ref: "global:livraison" });
  expect(machine.systemPrompt).toContain("## Travail en parallèle");
});

test("the command says when every subagent is allowed", async () => {
  const result = await preview({ ref: "global:full-delivery" });
  expect(result.command.allSubagents).toBe(true);
  expect(result.command.subagents).toEqual([]);
});

test("the command shows the merged rules and folders, each with its origin", async () => {
  const delivery = {
    ...EMPTY_DELIVERY,
    allow: ["Bash(pnpm *)", "Bash(git *)"],
    addDirs: ["/Users/a/Documents/emis"],
  };
  const withDelivery = previewOf({ ...testProject, meta: { ...testProject.meta, delivery } });
  for (const req of [{ projectId: "p1" }, { projectId: "p1", ticketId: "t3" }]) {
    const { command } = await withDelivery({ ref: "global:review-pr", ...req });
    expect(command.allow).toEqual(["Bash(git *)", "Bash(pnpm *)", "Skill(brainstorming)"]);
    expect(command.allowOrigins).toEqual([
      { rule: "Bash(git *)", origin: "agent" },
      { rule: "Bash(pnpm *)", origin: "project" },
      { rule: "Skill(brainstorming)", origin: "agent" },
    ]);
    expect(command.addDirs).toEqual([
      { dir: "/Users/a/.claude/skills", origin: "agent" },
      { dir: "/Users/a/Documents/emis", origin: "project" },
    ]);
  }
  const machine = await withDelivery({ ref: "global:review-pr" });
  expect(machine.command.allowOrigins.map((o) => o.origin)).toEqual(["agent", "agent"]);
});
