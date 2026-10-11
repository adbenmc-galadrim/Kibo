import { describe, expect, test } from "bun:test";
import {
  foldSignal,
  isOpenSignal,
  isWakeupMessage,
  SIGNAL_KINDS,
  SIGNAL_PROJECT_SPEC,
  type SignalEvent,
  SignalInput,
  SignalRef,
  type SignalRow,
  type SignalStatus,
  seqOfRef,
  signalLine,
  signalRef,
  WAKEUP_PREFIX,
  wakeupCount,
} from "./signal";

const ADAM = { kind: "human" as const, ref: "adam" };
const row: SignalRow = {
  id: "s1",
  seq: 3,
  projectId: "p1",
  runId: "r1",
  runLabel: "opus-dev-3",
  profileName: "Opus dev",
  originTicketId: "t1",
  originTicketKey: "KIB-14",
  ticketId: "t2",
  ticketKey: "KIB-16",
  kind: "blocker",
  title: "Attend le schéma",
  body: "Détails",
  createdAt: 100,
};
const at = (t: number, event: SignalEvent) => ({ at: t, event });
const read = (runId: string): SignalEvent => ({ type: "read", runId });
const handled: SignalEvent = { type: "handled", batchId: "b1", actionId: 2 };
const ignored: SignalEvent = { type: "ignored", by: ADAM, batchId: null, actionId: null };

describe("SignalInput", () => {
  test("trims the title and defaults the body", () => {
    expect(SignalInput.parse({ kind: "ticket", title: " Tests " })).toEqual({
      kind: "ticket",
      title: "Tests",
      body: "",
    });
  });

  test("rejects out-of-bounds fields", () => {
    expect(SignalInput.safeParse({ kind: "ticket", title: "  " }).success).toBe(false);
    expect(SignalInput.safeParse({ kind: "ticket", title: "x".repeat(201) }).success).toBe(false);
    expect(SignalInput.safeParse({ kind: "ticket", title: "x", body: "b".repeat(4_001) }).success).toBe(
      false,
    );
    expect(SignalInput.safeParse({ kind: "idea", title: "x" }).success).toBe(false);
    expect(SignalInput.safeParse({ kind: "ticket", title: "x", ticket: "kib-1" }).success).toBe(false);
    expect(SignalInput.safeParse({ kind: "ticket", title: "x", ticket: "KIB-1" }).success).toBe(true);
  });
});

describe("SignalRef", () => {
  test("accepts sig:<n> only", () => {
    expect(SignalRef.parse("sig:3")).toBe("sig:3");
    for (const bad of ["sig:0", "sig:", "3", "sig:1234567"])
      expect(SignalRef.safeParse(bad).success).toBe(false);
  });

  test("round-trips through the sequence", () => {
    expect(signalRef(12)).toBe("sig:12");
    expect(seqOfRef("sig:12")).toBe(12);
  });
});

describe("foldSignal", () => {
  test("starts new with its ref", () => {
    expect(foldSignal(row, [])).toMatchObject({
      status: "new",
      ref: "sig:3",
      readAt: null,
      readRunId: null,
      decidedAt: null,
      batchId: null,
      actionId: null,
      decidedBy: null,
    });
  });

  test("keeps the first read", () => {
    expect(foldSignal(row, [at(5, read("r9"))])).toMatchObject({
      status: "read",
      readAt: 5,
      readRunId: "r9",
    });
    expect(foldSignal(row, [at(5, read("r9")), at(8, read("r10"))])).toMatchObject({
      status: "read",
      readAt: 5,
      readRunId: "r9",
    });
  });

  test("records the first final decision only", () => {
    expect(foldSignal(row, [at(7, handled)])).toMatchObject({
      status: "handled",
      batchId: "b1",
      actionId: 2,
      decidedAt: 7,
    });
    expect(foldSignal(row, [at(7, handled), at(9, ignored)])).toMatchObject({
      status: "handled",
      decidedAt: 7,
    });
    expect(foldSignal(row, [at(4, ignored)])).toMatchObject({
      status: "ignored",
      decidedBy: ADAM,
      batchId: null,
      decidedAt: 4,
    });
    expect(foldSignal(row, [at(5, read("r9")), at(7, handled)])).toMatchObject({
      status: "handled",
      readAt: 5,
    });
    expect(foldSignal(row, [at(7, handled), at(9, read("r9"))])).toMatchObject({
      status: "handled",
      readAt: null,
    });
  });

  test("isOpenSignal is true for new and read only", () => {
    const statuses: SignalStatus[] = ["new", "read", "handled", "ignored"];
    expect(statuses.map((status) => isOpenSignal({ status }))).toEqual([true, true, false, false]);
  });
});

describe("signal tool and lines", () => {
  test("the MCP spec names the tool and requires kind and title", () => {
    expect(SIGNAL_PROJECT_SPEC.name).toBe("signal_project");
    expect(SIGNAL_PROJECT_SPEC.inputSchema.required).toEqual(["kind", "title"]);
    expect(SIGNAL_PROJECT_SPEC.inputSchema.properties.kind).toMatchObject({ enum: [...SIGNAL_KINDS] });
  });

  test("signalLine keeps the eight prompt fields", () => {
    expect(signalLine(foldSignal(row, []))).toEqual({
      ref: "sig:3",
      kind: "blocker",
      runLabel: "opus-dev-3",
      ticketKey: "KIB-16",
      createdAt: 100,
      status: "new",
      title: "Attend le schéma",
      body: "Détails",
    });
  });

  test("the wakeup prefix is fixed", () => {
    expect(WAKEUP_PREFIX).toBe("Réveil automatique : ");
  });

  test("a wake-up message is recognised by its prefix and gives its signal count", () => {
    expect(isWakeupMessage(`${WAKEUP_PREFIX}2 signaux à traiter (1 blocage)`)).toBe(true);
    expect(wakeupCount(`${WAKEUP_PREFIX}2 signaux à traiter (1 blocage)`)).toBe(2);
    expect(wakeupCount(`${WAKEUP_PREFIX}1 signal à traiter (1 ticket à créer)`)).toBe(1);
    expect(wakeupCount(`${WAKEUP_PREFIX}rien`)).toBeNull();
    expect(isWakeupMessage("Bonjour")).toBe(false);
    expect(wakeupCount("Bonjour")).toBeNull();
  });
});
