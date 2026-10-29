import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { KiboError, type ProjectMeta, type RpcRequest } from "@kibo/schema";
import { parseArgs } from "../args";
import type { DaemonClient } from "../daemon-client";
import { runCli } from "../index";
import { runTicketsCommand } from "./tickets";
import { ticketsSession } from "./tickets-session";
import { SILO_META } from "./tickets-test-kit";

const STARTED_AT = new Date(2026, 9, 16, 14, 10).getTime();
const KIBO_META: ProjectMeta = { ...SILO_META, id: "p-kibo", key: "KIB", name: "Kibo", folder: "/src/kibo" };
const SILO_IN_FOLDER: ProjectMeta = { ...SILO_META, folder: "/src/silo" };

type Answer = (req: Extract<RpcRequest, { method: "setTicketSession" }>) => unknown;

const ALIVE: Answer = () => ({ tool: "T3 Code", startedAt: STARTED_AT });
const branchUnknown: Answer = () => {
  throw new KiboError("NOT_FOUND", "no ticket declares this branch");
};

function fakeClient(answer: Answer = ALIVE, projects: readonly ProjectMeta[] = [KIBO_META, SILO_IN_FOLDER]) {
  const calls: RpcRequest[] = [];
  const client: DaemonClient = {
    async rpc(req) {
      const sent: RpcRequest = req;
      calls.push(sent);
      if (sent.method === "listProjects") return projects as never;
      if (sent.method !== "setTicketSession") throw new Error(`unexpected ${sent.method}`);
      return answer(sent) as never;
    },
    async raw() {
      throw new Error("unexpected raw");
    },
    async close() {},
  };
  const sessions = () => calls.filter((c) => c.method === "setTicketSession");
  return { client, calls, sessions, connect: async () => client };
}

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { home: tmpdir(), out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
  };
}

const session = (argv: string[], fake = fakeClient(), cwd = "/src/silo/.claude/worktrees/f5") => {
  const t = io();
  const { positional, flags } = parseArgs(argv);
  return { t, fake, run: () => ticketsSession(positional, flags, t.io, fake.connect, cwd) };
};

test("start sends the key, no cwd and the default tool to the project of the key", async () => {
  const s = session(["SILO-33", "start"]);
  expect(await s.run()).toBe(0);
  expect(s.fake.sessions()).toEqual([
    {
      method: "setTicketSession",
      projectId: "p-silo",
      ticketKey: "SILO-33",
      cwd: null,
      state: "start",
      tool: "T3 Code",
    },
  ]);
  expect(s.t.out).toEqual(["✓ SILO-33 : session T3 Code depuis 14:10"]);
});

test("--tool names the tool and a lowercase key is accepted", async () => {
  const s = session(["silo-33", "ping", "--tool", "Cursor"]);
  expect(await s.run()).toBe(0);
  expect(s.fake.sessions()).toMatchObject([{ ticketKey: "SILO-33", state: "ping", tool: "Cursor" }]);
});

test("without a key, sends the cwd to the project whose folder holds it", async () => {
  const s = session(["ping"]);
  expect(await s.run()).toBe(0);
  expect(s.fake.sessions()).toEqual([
    {
      method: "setTicketSession",
      projectId: "p-silo",
      ticketKey: null,
      cwd: "/src/silo/.claude/worktrees/f5",
      state: "ping",
      tool: "T3 Code",
    },
  ]);
  expect(s.t.out).toEqual(["✓ Session T3 Code depuis 14:10"]);
});

test("without a key, asks the other projects when the folder one declares no such branch", async () => {
  const fake = fakeClient((req) => {
    if (req.projectId === "p-silo") throw new KiboError("NOT_FOUND", "no ticket declares this branch");
    return { tool: "T3 Code", startedAt: STARTED_AT };
  });
  const s = session(["stop"], fake);
  expect(await s.run()).toBe(0);
  expect(s.fake.sessions().map((c) => c.projectId)).toEqual(["p-silo", "p-kibo"]);
  const outside = session(["stop"], fakeClient(), "/tmp/worktrees/silo-f5");
  expect(await outside.run()).toBe(0);
  expect(outside.fake.sessions().map((c) => c.projectId)).toEqual(["p-kibo"]);
});

test("a folder only holds the paths below it", async () => {
  const s = session(["ping"], fakeClient(), "/src/silo-old/app");
  expect(await s.run()).toBe(0);
  expect(s.fake.sessions().map((c) => c.projectId)).toEqual(["p-kibo"]);
});

test("--project restricts the search without a key", async () => {
  const s = session(["ping", "--project", "KIB"]);
  expect(await s.run()).toBe(0);
  expect(s.fake.sessions()).toMatchObject([{ projectId: "p-kibo", ticketKey: null }]);
});

test("no project declares the branch: code 1 and the stable message", async () => {
  const fake = fakeClient(() => {
    throw new KiboError("NOT_FOUND", "no ticket declares this branch");
  });
  const s = session(["ping"], fake);
  expect(await s.run()).toBe(1);
  expect(s.t.err).toEqual(["Aucun ticket ne déclare cette branche."]);
  expect(s.fake.sessions().map((c) => c.projectId)).toEqual(["p-silo", "p-kibo"]);
});

test("an unknown key gives code 1, an unknown project too", async () => {
  const fake = fakeClient(() => {
    throw new KiboError("NOT_FOUND", "ticket SILO-99 not found");
  });
  const s = session(["SILO-99", "start"], fake);
  expect(await s.run()).toBe(1);
  expect(s.t.err).toEqual(["Ticket introuvable : SILO-99"]);
  const nope = session(["NOPE-1", "start"]);
  expect(await nope.run()).toBe(1);
  expect(nope.t.err).toEqual(["Projet introuvable : NOPE"]);
});

test("other daemon errors are not swallowed", async () => {
  const fake = fakeClient(() => {
    throw new KiboError("FORBIDDEN", "local session required");
  });
  await expect(session(["SILO-33", "start"], fake).run()).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("stop tells the session is over, or that none was open", async () => {
  const s = session(["SILO-33", "stop"]);
  expect(await s.run()).toBe(0);
  expect(s.t.out).toEqual(["✓ SILO-33 : session terminée"]);
  const none = session(
    ["stop"],
    fakeClient(() => null),
  );
  expect(await none.run()).toBe(0);
  expect(none.t.out).toEqual(["Aucune session en cours."]);
});

test("--json prints the session the daemon returns", async () => {
  const s = session(["SILO-33", "start", "--json"]);
  expect(await s.run()).toBe(0);
  expect(JSON.parse(s.t.out.join("\n"))).toEqual({ tool: "T3 Code", startedAt: STARTED_AT });
});

test("usage (code 2) for an unknown state, a malformed key or extra words, before the daemon", async () => {
  for (const argv of [
    ["SILO-33", "pause"],
    [],
    ["C1-2", "start"],
    ["SILO-33", "start", "now"],
    ["start", "x"],
  ]) {
    let connected = false;
    const t = io();
    const { positional, flags } = parseArgs(argv);
    const connect = async () => {
      connected = true;
      return fakeClient().client;
    };
    expect(await ticketsSession(positional, flags, t.io, connect, "/src/silo")).toBe(2);
    expect(t.err.at(-1)).toContain("kibo tickets session [<clé>] <start|ping|stop>");
    expect(connected).toBe(false);
  }
  const t = io();
  const { positional, flags } = parseArgs(["SILO-33", "start", "--tool"]);
  expect(await ticketsSession(positional, flags, t.io, fakeClient().connect, "/src/silo")).toBe(2);
});

test("goes through kibo tickets session", async () => {
  const fake = fakeClient();
  const t = io();
  const { positional, flags } = parseArgs(["session", "SILO-33", "start"]);
  expect(await runTicketsCommand(positional, flags, t.io, fake.connect)).toBe(0);
  expect(fake.sessions()).toMatchObject([{ ticketKey: "SILO-33", cwd: null, state: "start" }]);
});

test("kibo tickets session without a daemon: code 1 and the stable message", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-cli-session-"));
  try {
    const err: string[] = [];
    const cliIo = { home, toolchain: DEV_TOOLCHAIN, out: () => {}, err: (l: string) => err.push(l) };
    expect(await runCli(["tickets", "session", "SILO-33", "start"], cliIo)).toBe(1);
    expect(err).toEqual(["Kibo n'est pas lancé : ouvre l'application Kibo, puis réessaie."]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

const project = (id: string, folder: string | null): ProjectMeta => ({
  ...SILO_META,
  id,
  key: id.toUpperCase(),
  name: id,
  folder,
});

test("without a key, the deepest folder holding the cwd is asked first, then the listing order", async () => {
  const projects = [project("src", "/src"), project("other", null), project("silo", "/src/silo")];
  const s = session(["ping"], fakeClient(branchUnknown, projects), "/src/silo/app");
  expect(await s.run()).toBe(1);
  expect(s.fake.sessions().map((c) => c.projectId)).toEqual(["silo", "src", "other"]);
});

test("without a key, folders of equal depth keep the listing order", async () => {
  const projects = [project("b", "/src/app"), project("a", "/src/app")];
  const s = session(["ping"], fakeClient(branchUnknown, projects), "/src/app/lib");
  expect(await s.run()).toBe(1);
  expect(s.fake.sessions().map((c) => c.projectId)).toEqual(["b", "a"]);
});

test("without a key, FORBIDDEN stops the search at the first project", async () => {
  const fake = fakeClient(() => {
    throw new KiboError("FORBIDDEN", "local session required");
  });
  const s = session(["ping"], fake);
  await expect(s.run()).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(fake.sessions()).toHaveLength(1);
});
