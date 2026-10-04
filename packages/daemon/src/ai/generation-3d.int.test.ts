import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { type AiHarness, startAiHarness } from "./testing/harness";
import type { CreateDraftInput } from "./testing/lifecycle-fixture";

setDefaultTimeout(240_000);
let h: AiHarness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const viewer: CreateDraftInput = {
  mode: "create",
  id: "viewer",
  title: "Visionneuse",
  kind: "widget",
  withServer: false,
  description: "Affiche le modèle 3D choisi dans les réglages, avec rotation lente.",
  template: "3d",
  attachments: [],
};

test("a 3D draft starts from the template and asks for webgl and the project files", async () => {
  h = await startAiHarness({ scenario: "generate-3d.json" });
  const draft = await h.rpc({ method: "startComponentDraft", draft: viewer });
  const review = await h.waitDraft(draft.id, "review");
  expect(review.template).toBe("3d");
  expect(review.report?.ok).toBe(true);
  expect(review.manifest?.capabilities).toEqual(["webgl", "assets"]);
  expect(review.manifest?.configSchema?.model?.asset).toBe("model");
  expect(review.publish?.newPermissions).toEqual(expect.arrayContaining(["cap:webgl", "cap:assets"]));
});
