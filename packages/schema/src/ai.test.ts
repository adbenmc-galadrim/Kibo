import { describe, expect, test } from "bun:test";
import {
  AiEvent,
  ComponentDraft,
  FinalizeComponentDraftInput,
  RpcRequest,
  StartComponentDraftInput,
  StarterPlan,
} from "./index";

const page = { title: "Kanban", kind: "view", components: [{ id: "kanban" }] };

describe("StarterPlan", () => {
  test("defaults config and accepts up to 8 pages", () => {
    const plan = StarterPlan.parse({ pages: Array.from({ length: 8 }, () => page) });
    expect(plan.pages[0]?.components[0]?.config).toEqual({});
  });
  test("rejects 9 pages, a 41-char title, a page without component", () => {
    expect(StarterPlan.safeParse({ pages: Array.from({ length: 9 }, () => page) }).success).toBe(false);
    expect(StarterPlan.safeParse({ pages: [{ ...page, title: "x".repeat(41) }] }).success).toBe(false);
    expect(StarterPlan.safeParse({ pages: [{ ...page, components: [] }] }).success).toBe(false);
  });
});

describe("StartComponentDraftInput", () => {
  const create = {
    mode: "create",
    id: "burndown",
    title: "Burndown",
    kind: "widget",
    withServer: false,
    description: "Burndown du sprint : tickets restants par jour.",
  };
  test("accepts a create draft and a short modify request", () => {
    expect(StartComponentDraftInput.parse(create).mode).toBe("create");
    expect(
      StartComponentDraftInput.parse({ mode: "modify", id: "burndown", description: "Titre" }).mode,
    ).toBe("modify");
  });
  test("rejects a 19-char description, an uppercase id, a 2001-char description and an adapter", () => {
    expect(StartComponentDraftInput.safeParse({ ...create, description: "x".repeat(19) }).success).toBe(
      false,
    );
    expect(StartComponentDraftInput.safeParse({ ...create, id: "Burndown" }).success).toBe(false);
    expect(StartComponentDraftInput.safeParse({ ...create, description: "x".repeat(2001) }).success).toBe(
      false,
    );
    expect(StartComponentDraftInput.safeParse({ ...create, kind: "adapter" }).success).toBe(false);
  });
});

test("ComponentDraft round-trips and caps attempts at 3", () => {
  const draft: ComponentDraft = {
    id: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
    componentId: "burndown",
    mode: "create",
    title: "Burndown",
    kind: "widget",
    withServer: false,
    baseVersion: null,
    description: "Burndown du sprint : tickets restants par jour.",
    runId: null,
    sessionId: null,
    status: "describing",
    attempts: 0,
    failure: null,
    incidents: [],
    createdAt: 1,
    updatedAt: 1,
  };
  expect(ComponentDraft.parse(draft)).toEqual(draft);
  expect(ComponentDraft.safeParse({ ...draft, attempts: 4 }).success).toBe(false);
});

test("finalize requires a sha256 hash and a trust level other than builtin", () => {
  const base = {
    draftId: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
    version: "0.1.0",
    hash: "a".repeat(64),
    trust: "sandboxed",
    strategy: "update-all",
    target: null,
  };
  expect(FinalizeComponentDraftInput.safeParse(base).success).toBe(true);
  expect(FinalizeComponentDraftInput.safeParse({ ...base, hash: "abc" }).success).toBe(false);
  expect(FinalizeComponentDraftInput.safeParse({ ...base, trust: "builtin" }).success).toBe(false);
});

test("RpcRequest carries the new AI methods", () => {
  expect(
    RpcRequest.parse({ method: "suggestStarter", role: "other", text: "Je suis freelance" }).method,
  ).toBe("suggestStarter");
  expect(
    RpcRequest.safeParse({
      method: "startComponentDraft",
      draft: { mode: "modify", id: "burndown", description: "Ajoute un titre" },
    }).success,
  ).toBe(true);
  expect(RpcRequest.safeParse({ method: "suggestStarter", role: "other", text: "" }).success).toBe(false);
});

test("AiEvent parses both events and nothing else", () => {
  expect(AiEvent.safeParse({ type: "starter.ready", runId: "r1", plan: null }).success).toBe(true);
  expect(
    AiEvent.safeParse({
      type: "draft.changed",
      draftId: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
      status: "review",
    }).success,
  ).toBe(true);
  expect(AiEvent.safeParse({ type: "run.changed", runId: "r1", state: "done" }).success).toBe(false);
});
