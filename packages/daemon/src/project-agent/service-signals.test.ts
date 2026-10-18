import { afterEach, beforeEach, expect, test } from "bun:test";
import type { RunView } from "@kibo/schema";
import { type Kit, PROJECT_ID, serviceKit } from "./service.test-helper";

let kit: Kit;
beforeEach(() => {
  kit = serviceKit();
});
afterEach(() => kit.cleanup());

const onProject = { projectId: PROJECT_ID };

function between(text: string, first: string, middle: string, last: string): boolean {
  const a = text.indexOf(first);
  const b = text.indexOf(middle);
  const c = text.indexOf(last);
  return a >= 0 && a < b && b < c;
}

async function openTurn(text = "Où en est-on ?"): Promise<RunView> {
  const started = kit.svc.send(PROJECT_ID, text);
  await kit.svc.turns.prepare(started, kit.dir);
  return started;
}

test("the first turn lists the open signals between the overview and the message, then marks them read", async () => {
  kit.signals.add(1, { ...onProject, kind: "ticket", title: "Tests du récepteur" });
  kit.signals.add(2, { ...onProject, kind: "blocker", title: "Attend KIB-12" });
  kit.signals.add(3, onProject);
  kit.signals.close(3);
  const run = kit.svc.send(PROJECT_ID, "Où en est-on ?");
  const markRead = kit.signals.markRead;
  let fingerprinted = false;
  kit.signals.markRead = (projectId, runId) => {
    fingerprinted = kit.store.fingerprint(runId) !== null;
    return markRead(projectId, runId);
  };
  const turn = await kit.svc.turns.prepare(run, kit.dir);
  expect(between(turn.prompt, "# Projet", "## Signaux à traiter", "# Message")).toBe(true);
  expect(turn.prompt).toContain("Signaux ouverts : 2");
  expect(turn.prompt).toContain(
    "- sig:1 · ticket à créer · opus-dev-2 · SILO-1 · t1001 · nouveau — « Tests du récepteur »",
  );
  expect(turn.prompt).toContain("- sig:2 · blocage");
  expect(turn.prompt).not.toContain("sig:3 ·");
  expect(kit.signals.calls).toContain(`markRead:${PROJECT_ID}:${run.id}`);
  expect(fingerprinted).toBe(true);
  expect(kit.signals.all().map((s) => s.status)).toEqual(["read", "read", "handled"]);
});

test("the next turns list the signals after the digest, already read ones flagged", async () => {
  kit.signals.add(1, onProject);
  const run = await openTurn();
  kit.signals.add(2, onProject);
  const turn = await kit.svc.turns.prepare({ ...run, turns: 1, pendingAnswer: "Et ensuite ?" }, kit.dir);
  expect(between(turn.prompt, "## Depuis ton dernier tour", "## Signaux à traiter", "# Message")).toBe(true);
  expect(turn.prompt).toContain("- sig:1 · ticket à créer · opus-dev-2 · SILO-1 · t1001 · déjà lu");
  expect(turn.prompt).toContain("- sig:2 · ticket à créer · opus-dev-2 · SILO-1 · t1002 · nouveau");
});

test("a turn without open signal has no signal section", async () => {
  const run = kit.svc.send(PROJECT_ID, "Où en est-on ?");
  const turn = await kit.svc.turns.prepare(run, kit.dir);
  expect(turn.prompt).not.toContain("Signaux à traiter");
  expect(turn.prompt).not.toContain("Signaux ouverts");
});

test("propose accepts open signal references and names unknown and closed ones", async () => {
  kit.signals.add(1, onProject);
  kit.signals.add(2, onProject);
  kit.signals.close(2);
  const run = await openTurn();
  const cite = (signals: string[]) =>
    kit.svc.propose(run, {
      summary: "Signaux",
      actions: [{ id: 1, why: "signalé", type: "createTicket", ref: "new:1", title: "Tests", signals }],
    });
  expect(() => cite(["sig:9"])).toThrow(
    expect.objectContaining({
      code: "INVALID_INPUT",
      detail: expect.stringContaining("signal inconnu « sig:9 »"),
    }),
  );
  expect(() => cite(["sig:2"])).toThrow(
    expect.objectContaining({
      code: "INVALID_INPUT",
      detail: expect.stringContaining("signal déjà clos « sig:2 »"),
    }),
  );
  expect(() =>
    kit.svc.propose(run, {
      summary: "Signaux",
      actions: [{ id: 1, why: "sans suite", type: "dismissSignal", signal: "sig:2" }],
    }),
  ).toThrow(expect.objectContaining({ detail: expect.stringContaining("signal déjà clos « sig:2 »") }));
  expect(kit.store.batches(run.id)).toHaveLength(0);
  cite(["sig:1"]);
  expect(kit.store.pendingBatch(PROJECT_ID)?.actions[0]?.signals).toEqual(["sig:1"]);
});

test("the project agent exposes its signal port and refuses the ticket run tools", async () => {
  const run = await openTurn();
  expect(kit.svc.signals).toBe(kit.signals);
  await expect(kit.svc.mcp.call(run, "signal_project", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
});
