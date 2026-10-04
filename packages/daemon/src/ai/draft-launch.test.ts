import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComponentDraft } from "@kibo/schema";
import { draftPaths } from "./draft-files";
import { launchDraft } from "./draft-launch";
import { createFakeClock, createFakeRuns } from "./testing/fake-ports";

const homes: string[] = [];
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

const draft = ComponentDraft.parse({
  id: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
  componentId: "chart",
  mode: "create",
  title: "Graphique d'avancement",
  kind: "widget",
  withServer: false,
  baseVersion: null,
  description: "Tickets par statut, en barres.",
  runId: null,
  sessionId: null,
  status: "describing",
  attempts: 0,
  failure: null,
  incidents: [],
  createdAt: 1,
  updatedAt: 1,
});

function launch(demo: boolean) {
  const home = mkdtempSync(join(tmpdir(), "kibo-launch-"));
  homes.push(home);
  const sdkDir = join(home, "sdk");
  mkdirSync(sdkDir);
  mkdirSync(draftPaths(home, draft.id).dir, { recursive: true });
  const runs = createFakeRuns();
  launchDraft(
    {
      runs,
      clock: createFakeClock(),
      args: () => [],
      env: () => ({}),
      paths: (d) => draftPaths(home, d.id),
      apply: (d) => d,
      onEnd: () => {},
    },
    { draft, sdkDir, prompt: "Écris le composant Kibo", resumeSessionId: null, event: "enqueued", demo },
  );
  return runs.runs[0]?.req;
}

test("a demo draft runs under the demo profile, any other under the generator, both guarded", () => {
  const demo = launch(true);
  const regular = launch(false);
  expect(demo?.profileId).toBe("demo");
  expect(regular?.profileId).toBe("generateur");
  expect(demo?.guard({ toolName: "Write", toolInput: { file_path: "/etc/x" } }).decision).toBe("deny");
});
