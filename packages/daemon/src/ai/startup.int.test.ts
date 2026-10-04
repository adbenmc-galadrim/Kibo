import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AiHarness, startAiHarness } from "./testing/harness";

let h: AiHarness | null = null;
const roots: string[] = [];
afterEach(async () => {
  await h?.stop();
  h = null;
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-startup-"));
  roots.push(dir);
  return dir;
};

test("a claude slow to answer does not delay the daemon startup", async () => {
  const slow = join(tempDir(), "claude");
  writeFileSync(slow, "#!/bin/sh\nsleep 4\nexit 1\n", { mode: 0o755 });
  const started = Date.now();
  h = await startAiHarness({ scenario: "onboarding-ok.json", claudeBin: slow });
  expect(Date.now() - started).toBeLessThan(3_000);
  expect(await h.rpc({ method: "listComponentDrafts" })).toEqual([]);
  expect(await h.rpc({ method: "getAiStatus" })).toMatchObject({ available: false, reason: "missing" });
}, 30_000);

test("a toolchain without @kibo/sdk starts the daemon and refuses the generator", async () => {
  h = await startAiHarness({ scenario: "onboarding-ok.json", toolchain: { root: tempDir() } });
  expect(await h.rpc({ method: "getAiStatus" })).toMatchObject({ available: true });
  await expect(
    h.rpc({
      method: "startComponentDraft",
      draft: {
        mode: "create",
        id: "burndown",
        title: "Burndown",
        kind: "widget",
        withServer: false,
        description: "Burndown du sprint : tickets restants par jour.",
        template: "blank",
        attachments: [],
      },
    }),
  ).rejects.toThrow("AI_UNAVAILABLE");
  expect(await h.rpc({ method: "listComponentDrafts" })).toEqual([]);
}, 30_000);
