import { describe, expect, test } from "bun:test";
import {
  AiEvent,
  ComponentDraft,
  DraftAttachmentInput,
  DraftAttachments,
  FinalizeComponentDraftInput,
  MAX_DRAFT_REVISIONS,
  ReviseComponentDraftInput,
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

const baseDraft = {
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
const image = { name: "a.png", mime: "image/png", data: "AAAA" } as const;

test("drafts carry attachments and revisions with defaults", () => {
  const d = ComponentDraft.parse(baseDraft);
  expect(d.attachments).toEqual([]);
  expect(d.revisions).toBe(0);
  expect(DraftAttachmentInput.safeParse({ ...image, name: "maquette.png" }).success).toBe(true);
  expect(DraftAttachmentInput.safeParse({ ...image, name: "../x.png" }).success).toBe(false);
  expect(DraftAttachmentInput.safeParse({ ...image, name: "a/b.png" }).success).toBe(false);
  expect(DraftAttachmentInput.safeParse({ ...image, name: `${"a".repeat(64)}.png` }).success).toBe(false);
  expect(DraftAttachmentInput.safeParse({ ...image, mime: "image/gif" }).success).toBe(false);
  expect(DraftAttachments.safeParse(Array(4).fill(image)).success).toBe(true);
  expect(DraftAttachments.safeParse(Array(5).fill(image)).success).toBe(false);
  expect(
    StartComponentDraftInput.parse({
      mode: "create",
      id: "x1",
      title: "X",
      kind: "widget",
      withServer: false,
      description: "a".repeat(20),
    }),
  ).toMatchObject({ attachments: [] });
  expect(
    StartComponentDraftInput.parse({ mode: "modify", id: "burndown", description: "Titre" }),
  ).toMatchObject({ attachments: [] });
  expect(
    StartComponentDraftInput.safeParse({
      mode: "modify",
      id: "burndown",
      description: "Titre",
      attachments: Array(5).fill(image),
    }).success,
  ).toBe(false);
  const created = {
    mode: "create",
    id: "x1",
    title: "X",
    kind: "widget",
    withServer: false,
    description: "a".repeat(20),
  };
  expect(StartComponentDraftInput.parse({ ...created, formats: ["medium", "half"] })).toMatchObject({
    formats: ["medium", "half"],
  });
  expect(StartComponentDraftInput.safeParse({ ...created, formats: [] }).success).toBe(false);
  expect(StartComponentDraftInput.safeParse({ ...created, formats: ["tiny"] }).success).toBe(false);
  expect(StartComponentDraftInput.safeParse({ ...created, formats: Array(6).fill("small") }).success).toBe(
    false,
  );
  const draftId = crypto.randomUUID();
  expect(ReviseComponentDraftInput.safeParse({ draftId, feedback: "ok", attachments: [] }).success).toBe(
    false,
  );
  expect(ReviseComponentDraftInput.parse({ draftId, feedback: "  Mets le total en gros " })).toEqual({
    draftId,
    feedback: "Mets le total en gros",
    attachments: [],
  });
  expect(ReviseComponentDraftInput.safeParse({ draftId, feedback: "x".repeat(2001) }).success).toBe(false);
  expect(ComponentDraft.safeParse({ ...baseDraft, revisions: MAX_DRAFT_REVISIONS + 1 }).success).toBe(false);
  expect(
    ComponentDraft.safeParse({ ...baseDraft, attachments: [{ name: "a.png", mime: "image/png", bytes: 0 }] })
      .success,
  ).toBe(false);
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
    attachments: [{ name: "maquette.png", mime: "image/png", bytes: 84_000 }],
    revisions: 2,
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
  const draftId = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";
  expect(
    RpcRequest.parse({ method: "reviseComponentDraft", draftId, feedback: "Mets le total en gros" }),
  ).toEqual({ method: "reviseComponentDraft", draftId, feedback: "Mets le total en gros", attachments: [] });
  expect(RpcRequest.safeParse({ method: "previewComponentDraft", draftId }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "previewComponentDraft", draftId: "x" }).success).toBe(false);
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
