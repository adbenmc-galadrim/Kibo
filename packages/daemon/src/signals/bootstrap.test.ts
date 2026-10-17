import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError, WAKEUP_PREFIX } from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { projectWritable, type SignalsBootInput, type SignalsDocs, startSignals } from "./bootstrap";
import { openSignalStore } from "./store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const home = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-signals-boot-"));
  dirs.push(d);
  return d;
};

function docs(readOnly: readonly string[] = []): SignalsDocs {
  return {
    projectIds: () => ["p1", "p2"],
    today: () => "2026-10-16",
    project: () => {
      throw new Error("the snapshot is not read here");
    },
    assertWritable(projectId) {
      if (readOnly.includes(projectId)) throw new KiboError("PERMISSION_DENIED", "read only");
    },
    identity: () => "adam",
    emit: () => undefined,
  };
}

const unused = () => {
  throw new Error("not reached");
};
const input = (h: string, d: SignalsDocs): SignalsBootInput => ({
  home: h,
  docs: d,
  trace: { note: unused },
  notify: () => undefined,
  agent: () => ({ send: unused }),
});

test("a reader cannot list or ignore signals, and a remote session is refused", async () => {
  const signals = startSignals(input(home(), docs(["p2"])));
  try {
    const list = { method: "listSignals", projectId: "p2" } as const;
    const ignore = { method: "ignoreSignal", projectId: "p2", signalId: "s1" } as const;
    await expect(signals.rpc.handle(list, LOCAL_CONTEXT)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    await expect(signals.rpc.handle(ignore, LOCAL_CONTEXT)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    const remote = { sessionHash: "r", remote: true };
    await expect(signals.rpc.handle({ ...list, projectId: "p1" }, remote)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await signals.rpc.handle({ ...list, projectId: "p1" }, LOCAL_CONTEXT)).toEqual({
      signals: [],
      wakeup: { projectId: "p1", lastAt: null, dueAt: null },
    });
  } finally {
    signals.stop();
  }
});

test("a project is writable only when it exists and accepts writes, without ever throwing", () => {
  const writable = projectWritable(docs(["p2"]));
  expect(writable("p1")).toBe(true);
  expect(writable("p2")).toBe(false);
  expect(writable("p9")).toBe(false);
});

test("a wake-up left due by the previous daemon is sent to the project agent at start, and stop closes the store", () => {
  const h = home();
  const store = openSignalStore(h);
  store.create({
    id: "s1",
    projectId: "p1",
    runId: "r1",
    runLabel: "opus-1",
    profileName: "opus",
    originTicketId: "t14",
    originTicketKey: "KIB-14",
    ticketId: "t14",
    ticketKey: "KIB-14",
    kind: "ticket",
    title: "Tests du récepteur de hooks",
    body: "",
    createdAt: 1,
  });
  store.saveWakeup({ projectId: "p1", lastAt: 1, dueAt: 2 });
  store.close();
  const sent: string[] = [];
  const signals = startSignals({
    ...input(h, docs()),
    agent: () => ({
      send(projectId, text) {
        sent.push(`${projectId}:${text}`);
      },
    }),
  });
  signals.start();
  signals.stop();
  expect(sent).toHaveLength(1);
  expect(sent[0]?.startsWith(`p1:${WAKEUP_PREFIX}1 signal`)).toBe(true);
  expect(() => signals.service.counts()).toThrow();
});
