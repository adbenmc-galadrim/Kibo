import { expect, test } from "bun:test";
import type { Environment, SandboxStatus } from "@kibo/schema";
import { welcomeChecks } from "./welcome-checks";

const base: Environment = {
  daemon: { address: "127.0.0.1:47831", home: "/Users/adam/.kibo" },
  ai: {
    available: true,
    reason: null,
    version: "2.1.283",
    loggedIn: true,
    profiles: { assistant: true, generateur: true },
  },
  git: "2.51",
  gh: "2.80",
  capacity: { cores: 8, ramGb: 16, hostSlots: 3 },
  github: { connected: false },
  app: { version: "1.5.0", platform: "darwin", arch: "arm64", home: "~/.kibo", daemonPid: 42, uptimeMs: 0 },
};

const isolated: SandboxStatus = {
  kind: "bwrap",
  available: true,
  reason: null,
  fix: null,
  allowUnsandboxed: false,
};

const byId = (env: Environment, sandbox: SandboxStatus | null, id: string) => {
  const row = welcomeChecks(env, sandbox).find((c) => c.id === id);
  if (!row) throw new Error(`missing row ${id}`);
  return row;
};

test("claude missing: warn, help with the two commands, retry", () => {
  const [, claude] = welcomeChecks(
    { ...base, ai: { ...base.ai, available: false, reason: "missing", loggedIn: null, version: null } },
    null,
  );
  expect(claude).toMatchObject({ id: "claude", state: "warn", retry: true });
  expect(claude?.help?.commands).toEqual(["npm install -g @anthropic-ai/claude-code", "claude"]);
  expect(claude?.detail).toBe("claude introuvable dans le PATH · les agents sont désactivés");
});

test("claude logged out: warn with /login help", () => {
  const claude = byId(
    { ...base, ai: { ...base.ai, available: false, reason: "logged_out", loggedIn: false } },
    null,
    "claude",
  );
  expect(claude).toMatchObject({ state: "warn", retry: true, detail: "claude détecté · non connecté" });
  expect(claude.help?.text).toContain("/login");
  expect(claude.help?.commands).toEqual(["claude"]);
});

test("git and gh are two rows; gh missing is optional, git missing is warn with retry", () => {
  const env = { ...base, git: null, gh: null };
  expect(welcomeChecks(env, null).map((c) => c.id)).toEqual([
    "daemon",
    "claude",
    "git",
    "gh",
    "capacity",
    "github",
  ]);
  expect(byId(env, null, "git")).toMatchObject({
    state: "warn",
    retry: true,
    title: "Git",
    detail: "git introuvable",
  });
  expect(byId(env, null, "gh")).toMatchObject({
    state: "optional",
    retry: false,
    title: "GitHub CLI",
    detail: "gh introuvable · facultatif",
  });
  expect(byId(base, null, "gh")).toMatchObject({
    state: "ok",
    detail: "gh 2.80 · pour les PR et la CI depuis Kibo",
  });
});

test("a stopped isolation is a warn row with its fix command", () => {
  const sandbox = {
    ...isolated,
    available: false,
    reason: "bubblewrap (bwrap) is not installed",
    fix: "sudo apt install bubblewrap",
  };
  const row = byId(base, sandbox, "isolation");
  expect(row).toMatchObject({ state: "warn", retry: true });
  expect(row.help).toEqual({
    text: "Pour réactiver l'isolation, lance :",
    commands: ["sudo apt install bubblewrap"],
  });
});

test("all green: no help, no retry", () => {
  const rows = welcomeChecks(base, isolated);
  expect(rows.map((c) => c.id)).toEqual(["daemon", "claude", "git", "gh", "capacity", "isolation", "github"]);
  expect(rows.every((c) => c.help === undefined && !c.retry)).toBe(true);
  expect(rows.filter((c) => c.state !== "ok").map((c) => c.id)).toEqual(["github"]);
});
