import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "@kibo/daemon/daemon";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { type ProjectCommand, Sprint, Ticket } from "@kibo/schema";
import { connectDaemon, type DaemonClient } from "../daemon-client";
import { runCli } from "../index";

const NOT_RUNNING = "Kibo n'est pas lancé : ouvre l'application Kibo, puis réessaie.";

function cli(home: string) {
  const out: string[] = [];
  const err: string[] = [];
  const io = {
    home,
    toolchain: DEV_TOOLCHAIN,
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
  };
  const run = (...argv: string[]) => runCli(["tickets", ...argv], io);
  const json = async (...argv: string[]): Promise<unknown> => {
    out.length = 0;
    expect(await run(...argv, "--json")).toBe(0);
    return JSON.parse(out.join("\n"));
  };
  return { out, err, run, json, io };
}

describe("kibo tickets without a daemon", () => {
  test("explains that Kibo is not running, with a stable code", async () => {
    const home = mkdtempSync(join(tmpdir(), "kibo-cli-tickets-"));
    try {
      const t = cli(home);
      expect(await t.run("list", "--project", "EMIS")).toBe(1);
      expect(t.err).toEqual([NOT_RUNNING]);
      await expect(connectDaemon(home)).rejects.toMatchObject({ code: "DAEMON_NOT_RUNNING" });
      writeFileSync(join(home, "daemon.json"), JSON.stringify({ port: 1, sandboxPort: 1, pid: 1 }));
      writeFileSync(join(home, "token"), "never-printed-token");
      expect(await t.run("get", "C1-2", "--project", "EMIS")).toBe(1);
      expect(t.err.at(-1)).toBe(NOT_RUNNING);
      expect([...t.out, ...t.err].join("\n")).not.toContain("never-printed-token");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("prints its usage", async () => {
    const t = cli(tmpdir());
    expect(await t.run()).toBe(2);
    expect(t.err.at(-1)).toContain("kibo tickets list --project");
    expect(await t.run("list")).toBe(2);
    expect(await t.run("get", "--project", "EMIS")).toBe(2);
  });
});

describe("kibo tickets against a real daemon", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-cli-tickets-"));
  let stop: () => Promise<void> = async () => {};
  let seed: DaemonClient;
  let projectId = "";
  const ids = new Map<string, string>();

  const command = (cmd: ProjectCommand) => seed.rpc({ method: "command", projectId, command: cmd });
  type CreateInput = Omit<Extract<ProjectCommand, { method: "createTicket" }>, "method" | "title">;
  async function ticket(planId: string | null, title: string, extra: CreateInput = {}) {
    const created = Ticket.parse(await command({ method: "createTicket", title, ...extra }));
    if (planId !== null) {
      ids.set(planId, created.id);
      await command({
        method: "upsertExternalRef",
        ticketId: created.id,
        ref: { kind: "import_ref", source: "plan", id: planId },
      });
    }
    return created;
  }

  beforeAll(async () => {
    const daemon = await startDaemon({
      home,
      port: 0,
      sandboxPort: 0,
      uiDir: null,
      dev: false,
      toolchain: DEV_TOOLCHAIN,
      user: "adam",
      integrations: { testOrigins: [], memorySecrets: true },
    });
    stop = async () => daemon.stop();
    seed = await connectDaemon(home);
    projectId = (
      await seed.rpc({ method: "createProject", name: "Emis", key: "EMIS", folder: null, color: "#336699" })
    ).id;
    const parent = await ticket("C1", "Chantier 1");
    const done = await ticket("C1-1", "Socle", { parentId: parent.id, statusId: "done" });
    await command({
      method: "upsertExternalRef",
      ticketId: done.id,
      ref: {
        kind: "github_pr",
        url: "https://github.com/galadrim/emis/pull/4",
        number: 4,
        state: "merged",
        base: "dev",
        head: "feat/socle",
      },
    });
    const next = await ticket("C1-2", "Stockage", { parentId: parent.id, description: "Tout le détail." });
    await ticket("C1-3", "Export", { parentId: parent.id, statusId: "in_progress" });
    await command({ method: "addLink", from: done.id, to: next.id, type: "blocks" });
    await command({
      method: "createQuestion",
      ticketId: next.id,
      title: "Quel bucket ?",
      createdBy: { kind: "agent", ref: "livraison" },
      recipient: "client",
      blocking: true,
    });
    const notes = join(home, "notes", "EMIS");
    mkdirSync(join(notes, "briefs"), { recursive: true });
    writeFileSync(join(notes, "briefs", "C1-2.md"), "# Brief C1-2\n");
    writeFileSync(join(notes, "stockage.md"), `# Stockage\n\nVoir ${next.key}.\n`);
  }, 120_000);

  afterAll(async () => {
    await seed.close();
    await stop();
    rmSync(home, { recursive: true, force: true });
  });

  test("list gives every ticket in JSON with plan ids, deps and the PR", async () => {
    const t = cli(home);
    const list = await t.json("list", "--project", "emis");
    expect(Array.isArray(list)).toBe(true);
    expect(list).toContainEqual({
      id: ids.get("C1-2"),
      key: "EMIS-3",
      planId: "C1-2",
      title: "Stockage",
      status: "todo",
      kiboStatus: "todo",
      column: "À faire",
      blockedReason: null,
      parent: { key: "EMIS-1", planId: "C1", status: "wip" },
      children: [],
      deps: [{ key: "EMIS-2", planId: "C1-1", status: "done" }],
      pr: null,
      assignee: null,
      labels: [],
      sprint: null,
      feature: { key: "EMIS-1", shortKey: "F1", title: "Chantier 1" },
      optional: false,
    });
    expect(await t.json("list", "--project", "Emis", "--ready")).toMatchObject([{ planId: "C1-2" }]);
    expect(await t.json("list", "--project", projectId, "--status", "wip,done")).toMatchObject([
      { planId: "C1" },
      { planId: "C1-1" },
      { planId: "C1-3" },
    ]);
    t.out.length = 0;
    expect(await t.run("list", "--project", "EMIS", "--ready")).toBe(0);
    expect(t.out).toEqual(["EMIS-3\tC1-2\ttodo\tStockage"]);
  });

  test("get adds the description, pending questions, linked notes and the brief", async () => {
    const t = cli(home);
    const detail = await t.json("get", "c1-2", "--project", "EMIS");
    expect(detail).toMatchObject({
      key: "EMIS-3",
      planId: "C1-2",
      description: "Tout le détail.",
      questions: [
        {
          title: "Quel bucket ?",
          recipient: { id: "client", name: "Client" },
          state: "open",
          blocking: true,
        },
      ],
      notes: [{ path: "stockage.md", title: "Stockage" }],
      brief: join(home, "notes", "EMIS", "briefs", "C1-2.md"),
    });
    t.out.length = 0;
    expect(await t.run("get", "EMIS-3", "--project", "EMIS")).toBe(0);
    expect(t.out).toContain("Statut : todo (À faire)");
    expect(t.out).toContain("  - [open] Quel bucket ? → Client (bloquante)");
    expect(t.out.at(-1)).toBe("Tout le détail.");
  });

  test("set writes the status and the PR through project commands", async () => {
    const t = cli(home);
    expect(await t.run("set", "C1-2", "status=wip", "pr=12", "--project", "EMIS")).toBe(0);
    expect(t.out.at(-1)).toBe("✓ EMIS-3 : status=wip pr=12");
    expect(await t.json("get", "C1-2", "--project", "EMIS")).toMatchObject({
      status: "wip",
      kiboStatus: "in_progress",
      pr: { number: 12, url: "https://github.com/galadrim/emis/pull/12", state: "open" },
    });
    expect(await t.run("set", "C1-2", "status=wip", "pr=12", "--project", "EMIS")).toBe(0);
    expect(t.out.at(-1)).toBe("✓ EMIS-3 : déjà à jour");
    expect(await t.json("set", "C1-3", "status=blocked", "--project", "EMIS")).toMatchObject({
      status: "blocked",
      blockedReason: "Bloqué par la livraison (kibo tickets)",
    });
  });

  test("declares a branch and follows the sprint of the feature", async () => {
    const t = cli(home);
    expect(await t.run("set", "C1-2", "branch=feat/c1-2-stockage", "base=dev", "--project", "EMIS")).toBe(0);
    const snapshot = await seed.rpc({ method: "getProject", projectId });
    const stored = snapshot.tickets.find((x) => x.id === ids.get("C1-2"));
    expect(stored?.externalRefs).toContainEqual({
      kind: "git_branch",
      branch: "feat/c1-2-stockage",
      base: "dev",
    });
    const sprint = Sprint.parse(
      await command({ method: "createSprint", name: "S42", start: "2026-10-12", end: "2026-10-23" }),
    );
    await command({ method: "setTicketSprint", ticketId: ids.get("C1") ?? "", sprintId: sprint.id });
    expect(await t.json("list", "--project", "EMIS", "--sprint", "s42")).toMatchObject([
      { planId: "C1", sprint: { id: sprint.id, name: "S42" } },
      { planId: "C1-1" },
      { planId: "C1-2" },
      { planId: "C1-3" },
    ]);
    const sprints = cli(home);
    expect(await runCli(["sprints", "list", "--project", "EMIS", "--json"], sprints.io)).toBe(0);
    expect(JSON.parse(sprints.out.join("\n"))).toMatchObject([{ name: "S42", features: ["EMIS-1"] }]);
  });

  test("refuses unknown assignments, projects and tickets", async () => {
    const t = cli(home);
    expect(await t.run("set", "C1-2", "owner=adam", "--project", "EMIS")).toBe(2);
    expect(t.err.at(-2)).toBe("Erreur INVALID_INPUT : unknown assignment: owner=adam");
    expect(await t.run("list", "--project", "NOPE")).toBe(1);
    expect(t.err.at(-1)).toBe("Projet introuvable : NOPE");
    expect(await t.run("get", "C9-9", "--project", "EMIS")).toBe(1);
    expect(t.err.at(-1)).toBe("Ticket introuvable : C9-9");
  });

  test("never prints the token and closes its session", async () => {
    const token = readFileSync(join(home, "token"), "utf8").trim();
    const sessions = async () => (await seed.rpc({ method: "listSessions" })).length;
    const before = await sessions();
    const t = cli(home);
    await t.run("list", "--project", "EMIS", "--json");
    await t.run("get", "C1-2", "--project", "EMIS");
    expect(await sessions()).toBe(before);
    writeFileSync(join(home, "token"), "wrong-token-value");
    try {
      expect(await t.run("list", "--project", "EMIS")).toBe(1);
      expect(t.err.at(-1)).toBe("Appairage refusé : le jeton de ~/.kibo/token ne correspond pas.");
    } finally {
      writeFileSync(join(home, "token"), token);
    }
    const printed = [...t.out, ...t.err].join("\n");
    expect(printed).not.toContain(token);
    expect(printed).not.toContain("wrong-token-value");
  });
});
