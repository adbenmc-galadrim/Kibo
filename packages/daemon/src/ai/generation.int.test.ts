import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { fakeWrites } from "../agents/fake-claude-ai";
import { fakeCalls } from "../agents/fake-claude-scenario";
import { type AiHarness, startAiHarness } from "./testing/harness";
import type { CreateDraftInput } from "./testing/lifecycle-fixture";

setDefaultTimeout(180_000);
let h: AiHarness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

async function projectWithPage(harness: AiHarness) {
  const p = await harness.rpc({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#14B8A6",
  });
  await harness.rpc({
    method: "command",
    projectId: p.id,
    command: { method: "addPage", title: "Tableau de bord", kind: "dashboard" },
  });
  const project = await harness.rpc({ method: "getProject", projectId: p.id });
  const page = project.pages.find((x) => x.title === "Tableau de bord");
  if (!page) throw new Error("page not created");
  return { projectId: p.id, pageId: page.id };
}

const create: CreateDraftInput = {
  mode: "create",
  id: "burndown",
  title: "Burndown",
  kind: "widget",
  withServer: false,
  description: "Burndown du sprint : tickets restants par jour.",
  attachments: [],
};

async function toReview(harness: AiHarness) {
  const draft = await harness.rpc({ method: "startComponentDraft", draft: create });
  return harness.waitDraft(draft.id, "review");
}

async function finalize(
  harness: AiHarness,
  draftId: string,
  target: { projectId: string; pageId: string } | null,
  version = "0.1.0",
  changes: string[] = [],
) {
  const reviewed = await harness.rpc({ method: "reviewComponentDraft", draftId, version, changes });
  const hash = reviewed.publish?.hash ?? "";
  return harness.rpc({
    method: "finalizeComponentDraft",
    draftId,
    version,
    hash,
    trust: "sandboxed",
    strategy: "update-all",
    target,
  });
}

const callsOf = (harness: AiHarness, sessionId: string | null) =>
  fakeCalls(harness.fakeState, sessionId ?? "");

test("1 · first-time success ⇒ review ⇒ finalize ⇒ sandboxed instance on the page", async () => {
  h = await startAiHarness({ scenario: "generate-ok.json" });
  const target = await projectWithPage(h);
  const review = await toReview(h);
  expect(review.diff.map((f) => f.path)).toEqual(["ui.tsx"]);
  expect(review.report?.ok).toBe(true);
  expect(review.manifest?.reads).toContain("ticket");
  expect(review.publish).toMatchObject({ status: "new", to: "0.1.0", from: null });
  const result = await finalize(h, review.id, target);
  expect(result).toMatchObject({ version: { version: "0.1.0", origin: "ai", trust: "sandboxed" } });
  expect(result.instanceId).not.toBeNull();
  const project = await h.rpc({ method: "getProject", projectId: target.projectId });
  expect(project.instances.map((i) => i.component)).toContain("burndown@0.1.0");
  const burndown = (await h.rpc({ method: "listComponents" })).find((c) => c.id === "burndown");
  expect(burndown?.versions[0]).toMatchObject({ origin: "ai", trust: "sandboxed", active: true });
  expect(existsSync(join(h.home, "components", "drafts", review.id))).toBe(false);
  expect(existsSync(join(h.home, "components", "src", "burndown", "CLAUDE.md"))).toBe(false);
  const argv = callsOf(h, review.sessionId)[0]?.argv ?? [];
  expect(argv[argv.indexOf("--tools") + 1]).toBe("Read,Edit,Write,Glob,Grep,Bash");
  expect(argv[argv.indexOf("--permission-mode") + 1]).toBe("acceptEdits");
  expect(argv.join(" ")).not.toContain("dangerously");
});

test("2 · typecheck failure, then success after --resume with the report", async () => {
  h = await startAiHarness({ scenario: "generate-retry.json" });
  const draft = await h.rpc({ method: "startComponentDraft", draft: create });
  const failed = await h.waitDraft(draft.id, "failed");
  expect(failed.report?.typecheck.ok).toBe(false);
  await h.rpc({ method: "retryComponentDraft", draftId: draft.id });
  const review = await h.waitDraft(draft.id, "review");
  expect(review.attempts).toBe(2);
  const [first, second] = callsOf(h, review.sessionId);
  expect(first?.argv).toContain("--session-id");
  expect(second?.argv).toContain("--resume");
  expect(second?.prompt).toContain("## Typecheck");
  expect(second?.prompt).toContain("ui.tsx:6 · Type 'number' is not assignable to type 'string'.");
});

test("3 · three failures ⇒ retry refused", async () => {
  h = await startAiHarness({ scenario: "generate-fail-3.json" });
  const draft = await h.rpc({ method: "startComponentDraft", draft: create });
  for (let i = 0; i < 2; i++) {
    await h.waitDraft(draft.id, "failed");
    await h.rpc({ method: "retryComponentDraft", draftId: draft.id });
  }
  const last = await h.waitDraft(draft.id, "failed");
  expect(last.attempts).toBe(3);
  await expect(h.rpc({ method: "retryComponentDraft", draftId: draft.id })).rejects.toThrow("INVALID_INPUT");
});

test("4 · guard denies reserved and outside writes; direct tampering is restored", async () => {
  h = await startAiHarness({ scenario: "generate-guard.json" });
  const review = await toReview(h);
  const dir = realpathSync(join(h.home, "components", "drafts", review.id));
  const writes = fakeWrites(h.fakeState, review.sessionId ?? "");
  const denied = writes.flatMap((w) => ("denied" in w ? [relative(dir, w.denied)] : []));
  expect(denied).toEqual(["kibo.component.json", join("..", "evil.ts")]);
  expect(existsSync(join(h.home, "components", "drafts", "evil.ts"))).toBe(false);
  expect(review.incidents).toEqual([
    { kind: "removed", path: "evil.ts" },
    { kind: "restored", path: "kibo.component.json" },
  ]);
  const manifest = JSON.parse(
    readFileSync(join(h.home, "components", "drafts", review.id, "kibo.component.json"), "utf8"),
  );
  expect(manifest).toMatchObject({ id: "burndown", version: "0.1.0", writes: [] });
  expect(manifest.net ?? []).toEqual([]);
});

test("5 · literal sdk.fetch ⇒ declared net permission; non-literal ⇒ validation failure", async () => {
  h = await startAiHarness({ scenario: "generate-fetch.json" });
  const review = await toReview(h);
  expect(review.manifest?.net).toEqual(["api.github.com/repos/kibo/kibo/issues"]);
  expect(review.publish?.newPermissions).toContain("net:api.github.com/repos/kibo/kibo/issues");
  await h.stop();
  h = await startAiHarness({ scenario: "generate-fetch-dynamic.json" });
  const draft = await h.rpc({ method: "startComponentDraft", draft: create });
  const failed = await h.waitDraft(draft.id, "failed");
  expect(failed.report?.permissions.errors.join("\n")).toContain(
    "argument non littéral : impossible de vérifier la permission (sdk.fetch(url))",
  );
});

test("modify · minor version proposed, published everywhere", async () => {
  h = await startAiHarness({ scenario: "modify-routes.json" });
  const target = await projectWithPage(h);
  const created = await toReview(h);
  await finalize(h, created.id, target);
  const draft = await h.rpc({
    method: "startComponentDraft",
    draft: { mode: "modify", id: "burndown", description: "Affiche le nombre d'issues", attachments: [] },
  });
  const review = await h.waitDraft(draft.id, "review");
  expect(review.publish).toMatchObject({
    from: "0.1.0",
    to: "0.2.0",
    status: "update",
    changes: ["Affiche le nombre d'issues"],
  });
  expect(review.publish?.usages.map((u) => u.version)).toEqual(["0.1.0"]);
  await finalize(h, draft.id, null, "0.2.0", ["Affiche le nombre d'issues"]);
  const project = await h.rpc({ method: "getProject", projectId: target.projectId });
  expect(project.instances.map((i) => i.component)).toContain("burndown@0.2.0");
});
