import { expect, test } from "bun:test";
import {
  DEFAULT_RECIPIENTS,
  PARALLEL_RULES,
  PARALLEL_RULES_TITLE,
  PROGRESS_TOOL,
  type Ticket,
} from "@kibo/schema";
import { NO_AGENT } from "./agents/compose";
import { executeProjectCommand, readProject } from "./commands";
import { buildBrief, buildRunContext, buildSystemPrompt } from "./context";
import { createProjectDoc } from "./project";

function project(plan: boolean) {
  const doc = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
  });
  const created = executeProjectCommand(doc, { method: "createTicket", title: "Formulaire" });
  const id = typeof created === "object" && created !== null && "id" in created ? String(created.id) : "";
  if (plan) {
    executeProjectCommand(doc, {
      method: "setTicketProgress",
      ticketId: id,
      runId: "r1",
      at: 1,
      plan: [
        { id: "a", title: "Lire le formulaire", status: "done", note: null },
        { id: "b", title: "Corriger la validation", status: "doing", note: null },
        { id: "c", title: "Ajouter un test", status: "todo", note: null },
      ],
    });
  }
  const snapshot = readProject(doc);
  const ticket = snapshot.tickets.find((t: Ticket) => t.id === id);
  if (!ticket) throw new Error("fixture ticket missing");
  return { project: snapshot, ticket };
}

test("the protocol asks for a plan, a report, a readable feed and lists the recipients", () => {
  const prompt = buildSystemPrompt([], NO_AGENT, {
    progress: true,
    recipients: DEFAULT_RECIPIENTS,
    signals: false,
    skillReview: false,
    parallel: false,
  });
  expect(prompt).toContain(`\`${PROGRESS_TOOL}\``);
  expect(prompt).toContain("plan");
  expect(prompt).toContain("compte rendu");
  expect(prompt).toContain("lecteur humain");
  expect(prompt).toContain("- me — Moi (technique)");
  expect(prompt).toContain("- client — Client");
});

test("without a protocol the prompt is unchanged", () => {
  const prompt = buildSystemPrompt([], NO_AGENT);
  expect(prompt).not.toContain(PROGRESS_TOOL);
  expect(prompt).toBe(
    buildSystemPrompt([], NO_AGENT, {
      progress: false,
      recipients: [],
      signals: false,
      skillReview: false,
      parallel: false,
    }),
  );
  expect(prompt.endsWith("- Skills : tous ceux de la machine et du projet.\n")).toBe(true);
});

test("the run context passes the protocol to the system prompt", () => {
  const { project: snapshot, ticket } = project(false);
  const protocol = {
    progress: true,
    recipients: DEFAULT_RECIPIENTS,
    signals: true,
    skillReview: false,
    parallel: true,
  };
  const ctx = buildRunContext({
    project: snapshot,
    ticket,
    domain: null,
    note: "",
    chain: [],
    agent: NO_AGENT,
    protocol,
  });
  expect(ctx.systemPrompt).toBe(buildSystemPrompt([], NO_AGENT, protocol));
  expect(ctx.files.find((f) => f.path === "CLAUDE.md")?.content).toContain(PROGRESS_TOOL);
});

test("the brief carries the plan of the ticket over to the next run", () => {
  const withPlan = project(true);
  const brief = buildBrief({ project: withPlan.project, ticket: withPlan.ticket, domain: null, note: "" });
  expect(brief).toContain("## Plan en cours");
  expect(brief).toContain("- [x] Lire le formulaire");
  expect(brief).toContain("- [ ] Corriger la validation (en cours)");
  expect(brief).toContain("- [ ] Ajouter un test");
  const bare = project(false);
  expect(buildBrief({ project: bare.project, ticket: bare.ticket, domain: null, note: "" })).not.toContain(
    "## Plan en cours",
  );
});

test("ticket runs are told to signal instead of creating tickets", () => {
  const base = { progress: true, recipients: DEFAULT_RECIPIENTS, skillReview: false, parallel: false };
  const prompt = buildSystemPrompt([], NO_AGENT, { ...base, signals: true });
  expect(prompt).toContain("`mcp__kibo__signal_project`");
  expect(prompt).toContain("Tu ne crées jamais de ticket");
  expect(prompt).toContain("Vingt signaux au plus par run");
  const without = buildSystemPrompt([], NO_AGENT, { ...base, signals: false });
  expect(without).not.toContain("signal_project");
  expect(prompt.replace(without.slice(0, without.indexOf("- Sous-agents")), "")).toStartWith("- Tu ne crées");
});

test("the skill review rule is added when the run may review its skills", () => {
  const base = { progress: true, recipients: [], signals: false, parallel: false };
  const prompt = buildSystemPrompt([], NO_AGENT, { ...base, skillReview: true });
  expect(prompt).toContain("`mcp__kibo__skill_review`");
  expect(prompt).toContain("Rien n'est modifié sans validation de l'utilisateur.");
  expect(buildSystemPrompt([], NO_AGENT, { ...base, skillReview: false })).not.toContain("skill_review");
});

test("ticket runs get the parallel work rules after the Kibo protocol", () => {
  const base = { progress: true, recipients: [], signals: true, skillReview: false };
  const prompt = buildSystemPrompt([], NO_AGENT, { ...base, parallel: true });
  const protocolAt = prompt.indexOf("## Protocole Kibo");
  const rulesAt = prompt.indexOf(
    `${PARALLEL_RULES_TITLE}\n\n${PARALLEL_RULES.map((r) => `- ${r}`).join("\n")}\n`,
  );
  expect(protocolAt).toBeGreaterThanOrEqual(0);
  expect(rulesAt).toBeGreaterThan(protocolAt);
  expect(prompt.endsWith("\n")).toBe(true);
  expect(buildSystemPrompt([], NO_AGENT, { ...base, parallel: false })).not.toContain(PARALLEL_RULES_TITLE);
});
