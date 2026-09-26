import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AiStatus, StarterPlan } from "@kibo/schema";
import { denyAllGuard } from "./draft-guard";
import type { AiAvailability } from "./ports";
import { createStarterService, parseStarterOutput, STARTER_TIMEOUT_MS } from "./starter";
import { createFakeClock, createFakeRuns, createRecordingEvents } from "./testing/fake-ports";

const known = new Set(["kanban", "tickets", "graph", "notes"]);
const plan: StarterPlan = {
  pages: [{ title: "Kanban", kind: "view", components: [{ id: "kanban", config: {} }] }],
};

describe("parseStarterOutput", () => {
  test("reads structured_output, then result text, then a bare plan", () => {
    expect(parseStarterOutput(JSON.stringify({ type: "result", structured_output: plan }), known)).toEqual(
      plan,
    );
    expect(
      parseStarterOutput(JSON.stringify({ type: "result", result: JSON.stringify(plan) }), known),
    ).toEqual(plan);
    const fenced = `\`\`\`json\n${JSON.stringify(plan)}\n\`\`\``;
    expect(parseStarterOutput(JSON.stringify({ type: "result", result: fenced }), known)).toEqual(plan);
    expect(parseStarterOutput(JSON.stringify(plan), known)).toEqual(plan);
  });
  test("reads a fenced plan surrounded by prose", () => {
    const text = `Voici ma proposition :\n\`\`\`json\n${JSON.stringify(plan)}\n\`\`\`\nBonne journée.`;
    expect(parseStarterOutput(JSON.stringify({ type: "result", result: text }), known)).toEqual(plan);
  });
  test("drops unknown components and empty pages, keeps one component per view", () => {
    const raw = {
      pages: [
        { title: "Vue", kind: "view", components: [{ id: "tickets" }, { id: "kanban" }] },
        { title: "Inconnu", kind: "view", components: [{ id: "burndown" }] },
        {
          title: "Accueil",
          kind: "dashboard",
          components: [{ id: "graph" }, { id: "nope" }, { id: "notes" }],
        },
      ],
    };
    expect(parseStarterOutput(JSON.stringify(raw), known)).toEqual({
      pages: [
        { title: "Vue", kind: "view", components: [{ id: "tickets", config: {} }] },
        {
          title: "Accueil",
          kind: "dashboard",
          components: [
            { id: "graph", config: {} },
            { id: "notes", config: {} },
          ],
        },
      ],
    });
  });
  test("truncates long titles and keeps 8 pages", () => {
    const long = { title: "x".repeat(60), kind: "view", components: [{ id: "kanban" }] };
    const out = parseStarterOutput(JSON.stringify({ pages: Array.from({ length: 12 }, () => long) }), known);
    expect(out?.pages).toHaveLength(8);
    expect(out?.pages[0]?.title).toHaveLength(40);
  });
  test("returns null for prose, truncated JSON, a bad kind or nothing usable", () => {
    for (const out of [
      "Voici mes suggestions : Kanban et Tickets.",
      '{"pages":[{"title":"Kanban","kind":"view"',
      JSON.stringify({ pages: [{ title: "A", kind: "grid", components: [{ id: "kanban" }] }] }),
      JSON.stringify({ pages: [{ title: "A", kind: "view", components: [{ id: "burndown" }] }] }),
      JSON.stringify({ type: "result", is_error: true, result: "Credit balance too low" }),
      "",
    ])
      expect(parseStarterOutput(out, known)).toBeNull();
  });
});

describe("createStarterService", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });
  const status = (patch: Partial<AiStatus> = {}): AiStatus => ({
    available: true,
    reason: null,
    version: "2.1.283",
    loggedIn: true,
    profiles: { assistant: true, generateur: true },
    ...patch,
  });
  function setup(s: AiStatus = status()) {
    const workRoot = mkdtempSync(join(tmpdir(), "kibo-starter-"));
    roots.push(workRoot);
    const runs = createFakeRuns();
    const clock = createFakeClock();
    const events = createRecordingEvents();
    const ai: AiAvailability = { status: () => s, capabilities: () => null, refresh: async () => s };
    const service = createStarterService({
      runs,
      ai,
      clock,
      events,
      workRoot,
      catalog: () => [{ id: "kanban", title: "Kanban", description: "Tickets par statut", kind: "both" }],
      prompt: ({ role, text, catalog }) => `${role}|${text}|${catalog.map((c) => c.id).join(",")}`,
      args: () => ["--tools", ""],
    });
    return { runs, clock, events, service };
  }

  test("refuses when claude is unavailable or the assistant profile is disabled", () => {
    expect(() =>
      setup(status({ available: false, reason: "missing" })).service.suggest({ role: "other", text: "x" }),
    ).toThrow("AI_UNAVAILABLE");
    const off = status({ profiles: { assistant: false, generateur: true } });
    expect(() => setup(off).service.suggest({ role: "other", text: "x" })).toThrow("AI_UNAVAILABLE");
  });

  test("enqueues an assistant run that may use no tool, in a private folder", () => {
    const { runs, service } = setup();
    const { runId } = service.suggest({ role: "pm", text: "Je pilote trois équipes" });
    const req = runs.runs[0]?.req;
    expect(runId).toBe("run-1");
    expect(req).toMatchObject({
      profileId: "assistant",
      prompt: "pm|Je pilote trois équipes|kanban",
      args: ["--tools", ""],
    });
    expect(req?.guard).toBe(denyAllGuard);
    expect(req?.guard({ toolName: "Read", toolInput: { file_path: "/etc/hosts" } }).decision).toBe("deny");
    expect(existsSync(req?.cwd ?? "")).toBe(true);
  });

  test("removes the private folder when the run cannot be enqueued", () => {
    const { runs, service } = setup();
    let cwd = "";
    runs.enqueue = (req) => {
      cwd = req.cwd;
      throw new Error("queue closed");
    };
    expect(() => service.suggest({ role: "other", text: "x" })).toThrow("queue closed");
    expect(cwd).not.toBe("");
    expect(existsSync(cwd)).toBe(false);
  });

  test("starts the delay when the run is already running once enqueued", () => {
    const { runs, clock, service } = setup();
    const enqueue = runs.enqueue;
    runs.enqueue = (req) => {
      const id = enqueue(req);
      runs.setState(id, "running");
      return id;
    };
    const { runId } = service.suggest({ role: "other", text: "x" });
    clock.advance(STARTER_TIMEOUT_MS);
    expect(runs.cancelled).toEqual([runId]);
  });

  test("publishes the plan when the run ends, then removes the folder", () => {
    const { runs, events, service } = setup();
    const { runId } = service.suggest({ role: "other", text: "x" });
    const cwd = runs.runs[0]?.req.cwd ?? "";
    runs.end(runId, {
      state: "done",
      sessionId: null,
      stdout: JSON.stringify({ structured_output: plan }),
      error: null,
    });
    expect(events.events).toEqual([{ type: "starter.ready", runId, plan }]);
    expect(existsSync(cwd)).toBe(false);
  });

  test("a failed or cancelled run publishes null", () => {
    const { runs, events, service } = setup();
    const { runId } = service.suggest({ role: "other", text: "x" });
    runs.end(runId, { state: "failed", sessionId: null, stdout: "", error: "exit 1" });
    expect(events.events).toEqual([{ type: "starter.ready", runId, plan: null }]);
  });

  test("cancels after 60 s of running; time spent in the queue does not count", () => {
    const { runs, clock, events, service } = setup();
    const { runId } = service.suggest({ role: "other", text: "x" });
    clock.advance(10 * STARTER_TIMEOUT_MS);
    expect(runs.cancelled).toEqual([]);
    runs.setState(runId, "running");
    clock.advance(STARTER_TIMEOUT_MS - 1);
    expect(runs.cancelled).toEqual([]);
    clock.advance(1);
    expect(runs.cancelled).toEqual([runId]);
    expect(events.events).toEqual([{ type: "starter.ready", runId, plan: null }]);
  });
});
