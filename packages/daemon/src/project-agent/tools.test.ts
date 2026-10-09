import { afterEach, describe, expect, test } from "bun:test";
import { fingerprint } from "@kibo/core/project-agent/fingerprint";
import {
  type Batch,
  KiboError,
  MEMORY_NOTE_PATH,
  type ProjectAgentTool,
  type ProjectFingerprint,
  Question,
  type RunView,
  type Ticket,
} from "@kibo/schema";
import { z } from "zod";
import { runView } from "../questions/questions.test-helper";
import { type Harness, HUMAN, harness } from "./fakes.test-helper";
import { handleProjectTool, TOOL_REPLY_MAX } from "./tools";

const Page = z.object({ items: z.array(z.unknown()), nextCursor: z.string().nullable(), total: z.number() });

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

type World = {
  h: Harness;
  run: RunView;
  tickets: Ticket[];
  saved: { fp: ProjectFingerprint | null };
  proposed: unknown[];
  tool(tool: ProjectAgentTool, input?: unknown): Promise<string>;
  json(tool: ProjectAgentTool, input?: unknown): Promise<unknown>;
};

async function world(): Promise<World> {
  const h = harness();
  open.push(h);
  const tickets = Array.from({ length: 60 }, (_, i) => h.ticket(`Ticket ${i + 1}`, i < 5 ? "done" : "todo"));
  const [t1, t2] = [tickets[0]?.id ?? "", tickets[1]?.id ?? ""];
  const ask = (ticketId: string, title: string) =>
    Question.parse(h.command({ method: "createQuestion", ticketId, title, createdBy: HUMAN, runId: null }));
  ask(t1, "Quel port ?");
  ask(t1, "Quelle base ?");
  const q3 = ask(t2, "Quel format ?");
  h.command({
    method: "answerQuestion",
    questionId: q3.id,
    answer: { kind: "text", text: "JSON" },
    by: HUMAN,
  });
  await h.data.writeNote(h.project.id, MEMORY_NOTE_PATH, "# Mémoire\n\nRien.\n", "create");
  await h.data.writeNote(h.project.id, "architecture.md", "# Architecture\n", "create");
  const other = h.createProject("Autre", "AUTRE");
  h.service.handle({
    method: "command",
    projectId: other.id,
    command: { method: "createTicket", title: "Ailleurs" },
  });
  const run = runView({
    id: "p-run",
    projectId: h.project.id,
    ticketId: null,
    kind: "project",
    state: "running",
  });
  h.agents.runs.push(
    runView({ id: "r1", projectId: h.project.id, ticketId: t1, ticketKey: "EMIS-1", state: "queued" }),
    runView({ id: "r2", projectId: other.id, ticketId: "x", ticketKey: "AUTRE-1", state: "running" }),
    run,
  );
  h.agents.queue.push({ runId: "r1", position: 1, reason: null });
  const saved: { fp: ProjectFingerprint | null } = { fp: null };
  const proposed: unknown[] = [];
  const lastDecided = (): Batch | null => null;
  const deps = {
    data: h.data,
    agents: () => h.agents,
    store: { fingerprint: () => saved.fp, lastDecided },
    propose: (_run: RunView, input: unknown) => {
      proposed.push(input);
      return "Lot 1 enregistré, en attente de validation de adam.";
    },
  };
  const tool = (name: ProjectAgentTool, input: unknown = {}) => handleProjectTool(deps, run, name, input);
  return {
    h,
    run,
    tickets,
    saved,
    proposed,
    tool,
    json: async (name, input) => JSON.parse(await tool(name, input)),
  };
}

const codeOf = async (p: Promise<unknown>): Promise<string | null> =>
  p.then(
    () => null,
    (e: unknown) => (e instanceof KiboError ? e.code : `unexpected ${String(e)}`),
  );

describe("read tools", () => {
  test("project_overview is the compact JSON overview with the memory note", async () => {
    const w = await world();
    const text = await w.tool("project_overview");
    expect(text).not.toContain("\n  ");
    const overview = JSON.parse(text);
    expect(overview).toMatchObject({ name: "Emis", key: "EMIS", memory: "# Mémoire\n\nRien.\n" });
    expect(overview.runs.map((r: { id: string }) => r.id)).toEqual(["r1"]);
    expect(overview.profiles.map((p: { id: string }) => p.id)).toEqual(["opus"]);
  });

  test("list_tickets pages by 50 and filters by status", async () => {
    const w = await world();
    const first = Page.parse(await w.json("list_tickets"));
    expect(first.items).toHaveLength(50);
    expect(first).toMatchObject({ nextCursor: "50", total: 60 });
    const second = Page.parse(await w.json("list_tickets", { cursor: "50" }));
    expect(second.items).toHaveLength(10);
    expect(second.nextCursor).toBeNull();
    expect(Page.parse(await w.json("list_tickets", { status: "done" })).total).toBe(5);
  });

  test("get_ticket returns the sheet; a ticket of another project is NOT_FOUND", async () => {
    const w = await world();
    const sheet = z
      .object({ key: z.string(), questions: z.array(z.unknown()) })
      .parse(await w.json("get_ticket", { key: "EMIS-1" }));
    expect(sheet.key).toBe("EMIS-1");
    expect(sheet.questions).toHaveLength(2);
    expect(await codeOf(w.tool("get_ticket", { key: "AUTRE-1" }))).toBe("NOT_FOUND");
    expect(await codeOf(w.tool("get_ticket", { key: "EMIS-999" }))).toBe("NOT_FOUND");
  });

  test("list_questions filters by state and ticket", async () => {
    const w = await world();
    expect(await w.json("list_questions")).toHaveLength(2);
    expect(await w.json("list_questions", { state: "all" })).toHaveLength(3);
    expect(await w.json("list_questions", { state: "all", ticketKey: "EMIS-2" })).toMatchObject([
      { answer: "JSON" },
    ]);
  });

  test("list_runs lists the ticket runs of the project with their queue position", async () => {
    const w = await world();
    expect(await w.json("list_runs")).toEqual([
      { id: "r1", label: "opus-dev", state: "queued", subject: "EMIS-1", position: 1 },
    ]);
    expect(await w.json("list_runs", { state: "done" })).toEqual([]);
  });

  test("list_notes pages the notes, read_note reads one, an absent note is NOT_FOUND", async () => {
    const w = await world();
    expect(await w.json("list_notes")).toEqual({
      items: [
        { path: MEMORY_NOTE_PATH, title: "Mémoire" },
        { path: "architecture.md", title: "Architecture" },
      ],
      nextCursor: null,
      total: 2,
    });
    expect(await w.json("read_note", { path: "architecture.md" })).toEqual({
      path: "architecture.md",
      content: "# Architecture\n",
    });
    expect(await codeOf(w.tool("read_note", { path: "absente.md" }))).toBe("NOT_FOUND");
  });

  test("list_profiles lists only the assignable profiles", async () => {
    const w = await world();
    expect(await w.json("list_profiles")).toEqual([{ id: "opus", name: "opus-dev", model: "opus" }]);
  });

  test("project_changes renders the whole digest since the saved fingerprint", async () => {
    const w = await world();
    expect(await codeOf(w.tool("project_changes"))).toBe("NOT_FOUND");
    const data = w.h.data;
    const notes = await data.notes(w.h.project.id);
    w.saved.fp = fingerprint({ project: data.project(w.h.project.id), runs: w.h.agents.runs, notes });
    expect(await w.tool("project_changes")).toContain("Aucun changement depuis ton dernier tour.");
    for (const t of w.tickets)
      w.h.command({ method: "updateTicket", ticketId: t.id, title: `${t.title} bis` });
    const digest = await w.tool("project_changes");
    expect(digest).toContain("## Depuis ton dernier tour");
    expect(digest.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(60);
    expect(digest).toContain("EMIS-60");
  });
});

describe("inputs and limits", () => {
  test("an invalid input is INVALID_INPUT with the Zod message", async () => {
    const w = await world();
    const error = await w.tool("list_tickets", { cursor: "abc" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(KiboError);
    expect(error instanceof KiboError && error.code).toBe("INVALID_INPUT");
    expect(error instanceof KiboError && error.message).toContain("cursor");
  });

  test("a reply above the limit is refused with a hint to filter or paginate", async () => {
    const w = await world();
    await w.h.data.writeNote(w.h.project.id, "gros.md", "x".repeat(TOOL_REPLY_MAX + 1), "create");
    const error = await w.tool("read_note", { path: "gros.md" }).catch((e: unknown) => e);
    expect(error instanceof KiboError && error.code).toBe("INVALID_INPUT");
    expect(error instanceof KiboError && error.message).toContain("filtre ou pagine");
  });

  test("propose_batch is delegated to propose with the raw input", async () => {
    const w = await world();
    const input = { summary: "Ranger", actions: [] };
    expect(await w.tool("propose_batch", input)).toBe("Lot 1 enregistré, en attente de validation de adam.");
    expect(w.proposed).toEqual([input]);
  });

  test("a run without a project is refused", async () => {
    const w = await world();
    const deps = {
      data: w.h.data,
      agents: () => w.h.agents,
      store: { fingerprint: () => null, lastDecided: () => null },
      propose: () => "",
    };
    const orphan = { ...w.run, projectId: null };
    expect(await codeOf(handleProjectTool(deps, orphan, "list_runs", {}))).toBe("FORBIDDEN");
  });
});
