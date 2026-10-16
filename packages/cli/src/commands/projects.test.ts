import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { EMPTY_DELIVERY, type ProjectMeta, type RpcRequest, type WorktreeSettings } from "@kibo/schema";
import type { DaemonClient } from "../daemon-client";
import { runCli } from "../index";
import { projectsCommand } from "./projects";

const WORKTREE: WorktreeSettings = {
  baseRef: "origin/dev",
  pathTemplate: "../emis-{slug}",
  setup: null,
  recipe: { copyFrom: ["{repo}"], copy: [".env"], env: null, after: ["pnpm install"] },
};
const DELIVERY = { ...EMPTY_DELIVERY, agent: "global:full-delivery", root: "/Users/a/emis" };

const meta = (over: Partial<ProjectMeta>): ProjectMeta => ({
  id: "p-kibo",
  key: "KIB",
  name: "Kibo",
  folder: null,
  color: "#336699",
  worktree: null,
  storybook: null,
  duplication: null,
  delivery: null,
  tracking: null,
  ...over,
});
const KIBO = meta({});
const EMIS = meta({
  id: "p-emis",
  key: "EMIS",
  name: "Emis",
  folder: "/Users/a/emis",
  worktree: WORKTREE,
  delivery: DELIVERY,
});

function fakeClient() {
  const calls: RpcRequest[] = [];
  const client: DaemonClient = {
    async rpc(req) {
      const sent: RpcRequest = req;
      calls.push(sent);
      if (sent.method === "listProjects") return [KIBO, { ...EMIS, folder: "/stale" }] as never;
      if (sent.method === "getProject") return { meta: sent.projectId === EMIS.id ? EMIS : KIBO } as never;
      throw new Error(`unexpected ${sent.method}`);
    },
    async close() {},
  };
  return { client, calls };
}

function run(args: string[], flags: Record<string, string | true> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const io = { home: tmpdir(), out: (l: string) => out.push(l), err: (l: string) => err.push(l) };
  const { client, calls } = fakeClient();
  const code = projectsCommand(args, flags, io, async () => client);
  return { code, out, err, calls };
}

test("list gives key, name and folder of every project", async () => {
  const json = run(["list"], { json: true });
  expect(await json.code).toBe(0);
  expect(JSON.parse(json.out.join("\n"))).toEqual([
    { key: "KIB", name: "Kibo", folder: null },
    { key: "EMIS", name: "Emis", folder: "/stale" },
  ]);
  const text = run(["list"]);
  expect(await text.code).toBe(0);
  expect(text.out).toEqual(["KIB\tKibo\t", "EMIS\tEmis\t/stale"]);
});

test("get gives the local folder, the worktree with its recipe and the delivery settings", async () => {
  const json = run(["get", "emis"], { json: true });
  expect(await json.code).toBe(0);
  expect(JSON.parse(json.out.join("\n"))).toEqual({
    key: "EMIS",
    name: "Emis",
    folder: "/Users/a/emis",
    worktree: WORKTREE,
    delivery: DELIVERY,
  });
  expect(json.calls.at(-1)).toEqual({ method: "getProject", projectId: "p-emis" });
});

test("get prints a readable block, with or without settings", async () => {
  const emis = run(["get", "EMIS"]);
  expect(await emis.code).toBe(0);
  expect(emis.out).toEqual([
    "EMIS · Emis",
    "Dossier : /Users/a/emis",
    "Worktree : origin/dev · ../emis-{slug}",
    "Recette : 1 fichier copié, 1 commande après",
    "Livraison : agent global:full-delivery · dossier /Users/a/emis",
  ]);
  const kibo = run(["get", "Kibo"]);
  expect(await kibo.code).toBe(0);
  expect(kibo.out).toEqual([
    "KIB · Kibo",
    "Dossier : aucun",
    "Worktree : réglages par défaut",
    "Recette : aucune",
    "Livraison : non configurée",
  ]);
});

test("refuses an unknown project and a bad usage", async () => {
  const missing = run(["get", "NOPE"]);
  expect(await missing.code).toBe(1);
  expect(missing.err).toEqual(["Projet introuvable : NOPE"]);
  for (const args of [[], ["get"], ["delete", "EMIS"]]) {
    const bad = run(args);
    expect(await bad.code).toBe(2);
    expect(bad.err.at(-1)).toContain("kibo projects get <clé|nom|id>");
  }
});

test("kibo projects without a daemon exits 1 with the stable message", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-cli-projects-"));
  try {
    const err: string[] = [];
    const io = { home, toolchain: DEV_TOOLCHAIN, out: () => {}, err: (l: string) => err.push(l) };
    expect(await runCli(["projects", "list", "--json"], io)).toBe(1);
    expect(err).toEqual(["Kibo n'est pas lancé : ouvre l'application Kibo, puis réessaie."]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
