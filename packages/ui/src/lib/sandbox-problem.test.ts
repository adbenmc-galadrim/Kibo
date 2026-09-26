import { expect, test } from "bun:test";
import type { SandboxStatus } from "@kibo/schema";
import { sandboxActive, sandboxProblem, sandboxStopped } from "./sandbox-problem";

const down = (over: Partial<SandboxStatus>): SandboxStatus => ({
  kind: "bwrap",
  available: false,
  reason: "",
  fix: null,
  allowUnsandboxed: false,
  ...over,
});

test("each diagnosis becomes a French problem, never the raw reason", () => {
  expect(sandboxProblem(down({ reason: "bubblewrap (bwrap) is not installed" }))).toBe(
    "bubblewrap introuvable",
  );
  expect(
    sandboxProblem(
      down({
        reason: "sandbox probe exited with 1: bwrap: setting up uid map: Permission denied",
        fix: "sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0",
      }),
    ),
  ).toBe("espaces de noms utilisateur interdits");
  expect(sandboxProblem(down({ reason: "sandbox probe exited with 2: boom" }))).toBe(
    "bubblewrap ne démarre pas",
  );
  expect(sandboxProblem(down({ kind: "sandbox-exec", reason: "sandbox-exec is missing" }))).toBe(
    "sandbox-exec indisponible",
  );
  expect(sandboxProblem(down({ kind: null, reason: "no OS sandbox on win32" }))).toBe(
    "aucune isolation OS sur ce système",
  );
});

test("the active mechanism and the stopped state", () => {
  const ok: SandboxStatus = {
    kind: "sandbox-exec",
    available: true,
    reason: null,
    fix: null,
    allowUnsandboxed: false,
  };
  expect(sandboxActive(ok)).toBe("sandbox-exec actif");
  expect(sandboxActive({ ...ok, kind: "bwrap" })).toBe("bubblewrap actif");
  expect(sandboxStopped(ok)).toBe(false);
  expect(sandboxStopped(down({}))).toBe(true);
  expect(sandboxStopped(down({ allowUnsandboxed: true }))).toBe(false);
});
