import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError, type RpcRequest } from "@kibo/schema";
import type { DaemonClient } from "../daemon-client";
import { runCli } from "../index";
import { ticketsStep } from "./tickets-step";

const PROJECTS = [
  { id: "p-kibo", key: "KIB", name: "Kibo" },
  { id: "p-silo", key: "SILO", name: "Silo" },
];

function fakeClient(fail: KiboError | null = null) {
  const calls: RpcRequest[] = [];
  const client: DaemonClient = {
    async rpc(req) {
      calls.push(req);
      if (req.method === "listProjects") return PROJECTS as never;
      if (fail) throw fail;
      const delivery = req.method === "setDeliveryStep" ? { ...req, at: 1, runId: null } : null;
      return { key: "SILO-15", delivery } as never;
    },
    async raw() {
      throw new Error("unexpected raw");
    },
    async close() {},
  };
  return { client, calls };
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

test("sends the step to the project found from the ticket key", async () => {
  const { client, calls } = fakeClient();
  const t = io();
  expect(await ticketsStep(["SILO-15", "7", "porte qualité"], {}, t.io, async () => client)).toBe(0);
  expect(calls).toEqual([
    { method: "listProjects" },
    { method: "setDeliveryStep", projectId: "p-silo", ticketKey: "SILO-15", step: 7, note: "porte qualité" },
  ]);
  expect(t.out).toEqual(["✓ SILO-15 : Étape 7/12 · Porte qualité"]);
});

test("accepts a lowercase key and no note", async () => {
  const { client, calls } = fakeClient();
  const t = io();
  expect(await ticketsStep(["silo-15", "0"], {}, t.io, async () => client)).toBe(0);
  expect(calls.at(-1)).toEqual({
    method: "setDeliveryStep",
    projectId: "p-silo",
    ticketKey: "SILO-15",
    step: 0,
  });
  expect(t.out).toEqual(["✓ SILO-15 : Étape 0/12 · Lecture"]);
});

test("--update marks a touch-up, without it no kind is sent", async () => {
  const { client, calls } = fakeClient();
  const t = io();
  expect(await ticketsStep(["SILO-15", "7"], { update: true }, t.io, async () => client)).toBe(0);
  expect(calls.at(-1)).toEqual({
    method: "setDeliveryStep",
    projectId: "p-silo",
    ticketKey: "SILO-15",
    step: 7,
    kind: "update",
  });
  expect(t.out).toEqual(["✓ SILO-15 : retouche · Étape 7/12 · Porte qualité"]);
  expect(await ticketsStep(["SILO-15", "7"], {}, t.io, async () => client)).toBe(0);
  expect(calls.at(-1)).not.toHaveProperty("kind");
});

test("refuses a step outside 0 to 11 before reaching the daemon", async () => {
  for (const step of ["12", "-1", "7.5", "sept"]) {
    let connected = false;
    const t = io();
    const connect = async () => {
      connected = true;
      return fakeClient().client;
    };
    expect(await ticketsStep(["SILO-15", step], {}, t.io, connect)).toBe(1);
    expect(t.err).toEqual([`Étape invalide : ${step} (étape entre 0 et 11)`]);
    expect(connected).toBe(false);
  }
});

test("reports an unknown project or ticket with code 1", async () => {
  const t = io();
  expect(await ticketsStep(["NOPE-1", "3"], {}, t.io, async () => fakeClient().client)).toBe(1);
  expect(t.err).toEqual(["Projet introuvable : NOPE"]);
  const missing = fakeClient(new KiboError("NOT_FOUND", "ticket SILO-99 not found")).client;
  await expect(ticketsStep(["SILO-99", "3"], {}, t.io, async () => missing)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("prints the usage for a missing step or a malformed key", async () => {
  const t = io();
  expect(await ticketsStep(["SILO-15"], {}, t.io, async () => fakeClient().client)).toBe(2);
  expect(await ticketsStep(["C1-2", "3"], {}, t.io, async () => fakeClient().client)).toBe(2);
  expect(t.err.at(-1)).toContain("kibo tickets step <clé> <0-11> [note]");
});

test("goes through kibo tickets step, without a daemon, with code 1 and the stable message", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-cli-step-"));
  try {
    const out: string[] = [];
    const err: string[] = [];
    const cliIo = {
      home,

      out: (l: string) => out.push(l),
      err: (l: string) => err.push(l),
    };
    expect(await runCli(["tickets", "step", "SILO-15", "7", "porte qualité"], cliIo)).toBe(1);
    expect(err).toEqual(["Kibo n'est pas lancé : ouvre l'application Kibo, puis réessaie."]);
    expect(await runCli(["tickets", "step", "SILO-15", "12"], cliIo)).toBe(1);
    expect(err.at(-1)).toBe("Étape invalide : 12 (étape entre 0 et 11)");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
