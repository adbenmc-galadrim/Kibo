import { expect, test } from "bun:test";
import { NOW, runFixture } from "./fixtures";
import {
  elapsed,
  errorText,
  formatDuration,
  formatGb,
  formatTokens,
  queueHint,
  reasonText,
  runResultText,
  workspaceText,
} from "./format";

const MIN = 60_000;

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
    "attend une place du profil opus-dev (2/2)",
  );
  expect(reasonText({ kind: "host", used: 3, total: 3 })).toBe("attend une place sur la machine (3/3)");
  expect(reasonText({ kind: "cpu", value: 91, threshold: 85 })).toBe("CPU 91 % (seuil 85 %)");
  expect(reasonText(null)).toBe("admission au prochain passage");
  expect(workspaceText("worktree:kib-14")).toBe("worktree kib-14");
  expect(workspaceText("isolated")).toBe("dossier isolé");
  expect(errorText("WORKSPACE_FAILED: the project has no local folder")).toBe(
    "espace de travail indisponible",
  );
  expect(errorText("PROJECT_FOLDER_MISSING: the project has no local folder")).toBe(
    "projet sans dossier local",
  );
  expect(errorText("PROJECT_FOLDER_NOT_FOUND: folder /x does not exist")).toBe(
    "dossier du projet introuvable",
  );
  expect(errorText("NOT_A_REPO: /x is not a git repository")).toBe(
    "le dossier du projet n'est pas un dépôt git",
  );
  expect(errorText("GIT_FAILED: git worktree add failed: fatal")).toBe(
    "git n'a pas pu préparer l'espace de travail",
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

test("the elapsed time is the active time, live during a turn only", () => {
  const paused = runFixture({
    id: "e",
    state: "waiting_input",
    startedAt: NOW - 60 * MIN,
    activeMs: 3 * MIN,
  });
  expect(elapsed(paused, NOW)).toBe(3 * MIN);
  expect(elapsed({ ...paused, state: "running", turnStartedAt: NOW - 2 * MIN }, NOW)).toBe(5 * MIN);
  expect(elapsed({ ...paused, state: "queued" }, NOW + 60 * MIN)).toBe(3 * MIN);
  expect(elapsed(runFixture({ id: "n", state: "queued" }), NOW)).toBe(0);
});

test("the queue says why a resumed run waits: an answer, a message, or the usual reason", () => {
  const reason = { kind: "paused" } as const;
  const resumed = runFixture({ id: "q", state: "queued", turns: 1, pendingAnswer: "Oui" });
  expect(queueHint({ ...resumed, question: "Quel port ?" }, reason)).toBe(
    "réponse reçue · reprise de la session",
  );
  expect(queueHint(resumed, reason)).toBe("message reçu · reprise de la session");
  expect(queueHint(runFixture({ id: "f", state: "queued", turns: 0, pendingAnswer: "Oui" }), reason)).toBe(
    "admission en pause",
  );
  expect(queueHint(runFixture({ id: "n", state: "queued", turns: 1 }), null)).toBe(reasonText(null));
});
