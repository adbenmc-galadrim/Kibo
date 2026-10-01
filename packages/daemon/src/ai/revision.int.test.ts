import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fakeToolUses } from "../agents/fake-claude-ai";
import { fakeCalls } from "../agents/fake-claude-scenario";
import { draftPaths } from "./draft-files";
import { type AiHarness, startAiHarness } from "./testing/harness";
import type { CreateDraftInput } from "./testing/lifecycle-fixture";
import { png } from "./testing/revise-fixture";

setDefaultTimeout(240_000);
let h: AiHarness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const create: CreateDraftInput = {
  mode: "create",
  id: "burndown",
  title: "Burndown",
  kind: "widget",
  withServer: false,
  description: "Burndown du sprint : tickets restants par jour.",
  attachments: [],
};

const sandbox = (harness: AiHarness, path: string) =>
  fetch(`${harness.sandboxUrl}${path}`, { headers: { cookie: "kibo_session=x" } });

async function finalize(harness: AiHarness, draftId: string) {
  const reviewed = await harness.rpc({
    method: "reviewComponentDraft",
    draftId,
    version: "0.1.0",
    changes: [],
  });
  return harness.rpc({
    method: "finalizeComponentDraft",
    draftId,
    version: "0.1.0",
    hash: reviewed.publish?.hash ?? "",
    trust: "sandboxed",
    strategy: "update-all",
    target: null,
  });
}

test("attachments are read by the agent, the preview is served, a revision rewrites the component", async () => {
  h = await startAiHarness({ scenario: "generate-revise.json" });
  const started = await h.rpc({
    method: "startComponentDraft",
    draft: { ...create, attachments: [png("maquette.png")] },
  });
  const review = await h.waitDraft(started.id, "review");
  const images = draftPaths(h.home, review.id).attachmentsDir;
  const sessionId = review.sessionId ?? "";
  const [first] = fakeCalls(h.fakeState, sessionId);
  expect(first?.prompt).toContain(join(images, "1-maquette.png"));
  expect(fakeToolUses(h.fakeState, sessionId)).toContainEqual({
    tool: "Read",
    input: { file_path: join(images, "1-maquette.png") },
    denied: false,
  });
  expect(fakeToolUses(h.fakeState, sessionId).every((u) => !u.denied)).toBe(true);

  const preview = await h.rpc({ method: "previewComponentDraft", draftId: review.id });
  expect(preview.path).toBe(`/c/drafts/${review.id}/${preview.hash}/index.html`);
  const page = await sandbox(h, preview.path);
  expect(page.status).toBe(200);
  expect(page.headers.get("content-security-policy")).toContain("connect-src 'none'");
  expect(page.headers.get("cache-control")).toBe("no-store");
  expect(page.headers.get("set-cookie")).toBeNull();
  const bundle = await sandbox(h, `/c/drafts/${review.id}/${preview.hash}/ui.sandbox.js`);
  expect(bundle.status).toBe(200);
  expect(await bundle.text()).toContain("tickets restants");
  expect((await sandbox(h, `/c/drafts/${review.id}/${preview.hash}/ui.css`)).status).toBe(200);
  const dir = realpathSync(draftPaths(h.home, review.id).dir);
  expect(existsSync(join(dir, ".kibo", "preview", preview.hash, "ui.sandbox.js"))).toBe(true);

  const revised = await h.rpc({
    method: "reviseComponentDraft",
    draftId: review.id,
    feedback: "Mets le total en gros",
    attachments: [png("retour.png")],
  });
  expect(revised).toMatchObject({ status: "generating", revisions: 1, attempts: 1 });
  expect((await sandbox(h, preview.path)).status).toBe(404);
  const again = await h.waitDraft(review.id, "review");
  expect(again.sessionId).toBe(sessionId);
  expect(again.diff.flatMap((f) => f.hunks.flatMap((x) => x.lines.map((l) => l.text))).join("\n")).toContain(
    "(révisé)",
  );
  const second = fakeCalls(h.fakeState, sessionId)[1];
  expect(second?.argv).toContain("--resume");
  expect(second?.prompt).toContain("Retour de l'utilisateur après aperçu : « Mets le total en gros »");
  expect(second?.prompt).toContain(join(images, "2-retour.png"));
  expect(second?.prompt).not.toContain(join(images, "1-maquette.png"));
  expect(fakeToolUses(h.fakeState, sessionId)).toContainEqual({
    tool: "Read",
    input: { file_path: join(images, "2-retour.png") },
    denied: false,
  });

  expect((await sandbox(h, preview.path)).status).toBe(404);
  expect((await sandbox(h, `/c/drafts/${review.id}/${preview.hash}/ui.sandbox.js`)).status).toBe(404);
  const next = await h.rpc({ method: "previewComponentDraft", draftId: review.id });
  expect(next.hash).not.toBe(preview.hash);
  const revisedBundle = await sandbox(h, `/c/drafts/${review.id}/${next.hash}/ui.sandbox.js`);
  expect(await revisedBundle.text()).toContain("(révisé)");

  await finalize(h, review.id);
  expect((await h.waitDraft(review.id, "done")).status).toBe("done");
  expect((await sandbox(h, next.path)).status).toBe(404);
  expect(existsSync(images)).toBe(false);
});

test("a fixed width is refused by the validation, then fixed on retry", async () => {
  h = await startAiHarness({ scenario: "generate-fixed-width.json" });
  const draft = await h.rpc({ method: "startComponentDraft", draft: create });
  const failed = await h.waitDraft(draft.id, "failed");
  expect(failed.report?.conformance.ok).toBe(false);
  expect(failed.report?.conformance.errors[0]).toContain("largeur fixe w-[480px]");
  await expect(h.rpc({ method: "previewComponentDraft", draftId: draft.id })).rejects.toThrow(
    "INVALID_INPUT",
  );
  await h.rpc({ method: "retryComponentDraft", draftId: draft.id });
  const review = await h.waitDraft(draft.id, "review");
  expect(review.attempts).toBe(2);
  const [, second] = fakeCalls(h.fakeState, review.sessionId ?? "");
  expect(second?.prompt).toContain("## Conformité");
  expect(second?.prompt).toContain("largeur fixe w-[480px]");
});
