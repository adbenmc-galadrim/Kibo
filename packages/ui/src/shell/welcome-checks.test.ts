import { expect, test } from "bun:test";
import type { Environment } from "@kibo/schema";
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
  app: {
    version: "1.5.0",
    platform: "darwin",
    arch: "arm64",
    home: "~/.kibo",
    userHome: null,
    daemonPid: 42,
    uptimeMs: 0,
    fixedNow: null,
    today: "2026-10-16",
  },
};

const byId = (env: Environment, id: string) => {
  const row = welcomeChecks(env).find((c) => c.id === id);
  if (!row) throw new Error(`missing row ${id}`);
  return row;
};

test("only what tracking needs: git, gh, Claude Code for the project agent and the GitHub account", () => {
  expect(welcomeChecks(base).map((c) => [c.id, c.title])).toEqual([
    ["git", "Git"],
    ["gh", "GitHub CLI"],
    ["claude", "Claude Code · pour l'agent de projet"],
    ["github", "Compte GitHub"],
  ]);
});

test("claude missing or logged out is optional: only the project agent is unavailable", () => {
  const missing = byId(
    { ...base, ai: { ...base.ai, available: false, reason: "missing", loggedIn: null, version: null } },
    "claude",
  );
  expect(missing).toMatchObject({
    state: "optional",
    retry: true,
    detail: "claude introuvable · l'agent de projet n'est pas disponible",
  });
  expect(missing.help?.commands).toEqual(["npm install -g @anthropic-ai/claude-code", "claude"]);
  const loggedOut = byId(
    { ...base, ai: { ...base.ai, available: false, reason: "logged_out", loggedIn: false } },
    "claude",
  );
  expect(loggedOut).toMatchObject({
    state: "optional",
    detail: "claude détecté · non connecté, l'agent de projet n'est pas disponible",
  });
  expect(loggedOut.help?.commands).toEqual(["claude"]);
  expect(byId(base, "claude")).toMatchObject({
    state: "ok",
    detail: "claude détecté · connecté à ton abonnement",
  });
});

test("git missing: warn with retry, branches are not followed", () => {
  expect(byId({ ...base, git: null }, "git")).toMatchObject({
    state: "warn",
    retry: true,
    detail: "git introuvable · sans lui, Kibo ne suit pas les branches",
  });
});

test("gh missing is not optional: warn, what is lost, and how to install it", () => {
  const gh = byId({ ...base, gh: null }, "gh");
  expect(gh).toMatchObject({
    state: "warn",
    retry: true,
    detail: "gh introuvable · sans lui, ni PR, ni review, ni CI dans Kibo",
  });
  expect(gh.help?.commands).toEqual(["brew install gh", "gh auth login"]);
  expect(byId(base, "gh")).toMatchObject({
    state: "ok",
    detail: "gh 2.80 · remonte les PR, leur review et la CI",
  });
});

test("all green: no help, no retry, the account stays to connect", () => {
  const rows = welcomeChecks(base);
  expect(rows.every((c) => c.help === undefined && !c.retry)).toBe(true);
  expect(rows.filter((c) => c.state !== "ok").map((c) => c.id)).toEqual(["github"]);
  expect(byId({ ...base, github: { connected: true } }, "github").state).toBe("ok");
});
