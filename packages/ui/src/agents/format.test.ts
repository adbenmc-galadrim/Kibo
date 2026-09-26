import { expect, test } from "bun:test";
import { runFixture } from "./fixtures";
import {
  errorText,
  formatDuration,
  formatGb,
  formatTokens,
  reasonText,
  runResultText,
  workspaceText,
} from "./format";

test("durations and token counts read like the mockups", () => {
  expect(formatDuration(45_000)).toBe("45s");
  expect(formatDuration(12 * 60_000)).toBe("12m");
  expect(formatDuration(3 * 3_600_000)).toBe("3h");
  expect(formatTokens(850)).toBe("850");
  expect(formatTokens(1_800)).toBe("1,8k");
  expect(formatTokens(3_000)).toBe("3k");
  expect(formatTokens(48_200)).toBe("48k");
  expect(formatTokens(1_200_000)).toBe("1,2M");
  expect(formatGb(11.2)).toBe("11,2");
});

test("wait reasons, workspaces and errors are said in French", () => {
  expect(reasonText({ kind: "profile", profileName: "opus-dev", used: 2, total: 2 })).toBe(
    "attend un créneau opus-dev (2/2)",
  );
  expect(reasonText({ kind: "host", used: 3, total: 3 })).toBe("attend un créneau hôte (3/3)");
  expect(reasonText({ kind: "cpu", value: 91, threshold: 85 })).toBe("CPU 91 % (seuil 85 %)");
  expect(reasonText(null)).toBe("admission au prochain passage");
  expect(workspaceText("worktree:kib-14")).toBe("worktree kib-14");
  expect(workspaceText("isolated")).toBe("dossier isolé");
  expect(errorText("WORKSPACE_FAILED: the project has no local folder")).toBe(
    "espace de travail indisponible",
  );
  expect(errorText("exit code 1")).toBe("exit code 1");
});

test("a run result says where the run is", () => {
  expect(runResultText(runFixture({ id: "a", state: "queued" }), 2)).toBe("En file #2");
  expect(runResultText(runFixture({ id: "b", state: "failed", error: "exit code 1" }), null)).toBe(
    "Échec : exit code 1",
  );
  expect(runResultText(runFixture({ id: "c", state: "waiting_input" }), null)).toBe("Attend une réponse");
});
