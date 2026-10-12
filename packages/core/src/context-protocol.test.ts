import { expect, test } from "bun:test";
import { DEFAULT_RECIPIENTS, PROGRESS_TOOL, type Ticket } from "@kibo/schema";
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
  const prompt = buildSystemPrompt([], [], {
    progress: true,
    recipients: DEFAULT_RECIPIENTS,
    signals: false,
  });
  expect(prompt).toContain(`\`${PROGRESS_TOOL}\``);
  expect(prompt).toContain("plan");
  expect(prompt).toContain("compte rendu");
  expect(prompt).toContain("lecteur humain");
  expect(prompt).toContain("- me — Moi (technique)");
  expect(prompt).toContain("- client — Client");
});

test("without a protocol the prompt is unchanged", () => {
  const prompt = buildSystemPrompt([], ["sonnet"]);
  expect(prompt).not.toContain(PROGRESS_TOOL);
  expect(prompt).toBe(buildSystemPrompt([], ["sonnet"], { progress: false, recipients: [], signals: false }));
  expect(prompt.endsWith("- Sous-agents autorisés : Sonnet.\n")).toBe(true);
});

test("the run context passes the protocol to the system prompt", () => {
  const { project: snapshot, ticket } = project(false);
  const protocol = { progress: true, recipients: DEFAULT_RECIPIENTS, signals: true };
  const ctx = buildRunContext({
    project: snapshot,
    ticket,
    domain: null,
    note: "",
    chain: [],
    subagents: [],
    protocol,
  });
  expect(ctx.systemPrompt).toBe(buildSystemPrompt([], [], protocol));
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
  const base = { progress: true, recipients: DEFAULT_RECIPIENTS };
  const prompt = buildSystemPrompt([], [], { ...base, signals: true });
  expect(prompt).toContain("`mcp__kibo__signal_project`");
  expect(prompt).toContain("Tu ne crées jamais de ticket");
  expect(prompt).toContain("Vingt signaux au plus par run");
  const without = buildSystemPrompt([], [], { ...base, signals: false });
  expect(without).not.toContain("signal_project");
  expect(prompt.replace(without.slice(0, without.indexOf("- Sous-agents")), "")).toStartWith("- Tu ne crées");
});
