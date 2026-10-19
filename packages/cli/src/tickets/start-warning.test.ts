import { describe, expect, test } from "bun:test";
import type { StartReason } from "@kibo/schema";
import { notStartableReasons } from "./start-warning";

const refused = (startReason: StartReason | null, waitingOn: string[] = []) =>
  notStartableReasons({ startable: false, startReason, waitingOn });

describe("notStartableReasons", () => {
  test("translates the reason the daemon gave", () => {
    expect(refused({ kind: "question", label: "Q14" })).toEqual(["bloqué par Q14"]);
    expect(refused({ kind: "dependency", keys: ["SILO-33", "SILO-34"] })).toEqual([
      "attend SILO-33, SILO-34",
    ]);
    expect(refused({ kind: "sprint", code: "S43" })).toEqual(["sprint S43"]);
    expect(refused({ kind: "unplanned" })).toEqual(["sans sprint"]);
    expect(refused({ kind: "limit", limit: 2, count: 2 })).toEqual(["limite atteinte"]);
    const hold = { source: "own" as const, key: "SILO-33", reason: "Accès au serveur", since: "2026-10-16" };
    expect(refused({ kind: "onHold", hold })).toEqual(["en attente : Accès au serveur"]);
    expect(refused({ kind: "onHold", hold: { ...hold, source: "dependency" } })).toEqual([
      "en attente de SILO-33",
    ]);
  });

  test("adds the steps the ticket waits on, once", () => {
    expect(refused({ kind: "question", label: "Q14" }, ["SILO-33"])).toEqual([
      "bloqué par Q14",
      "attend SILO-33",
    ]);
    expect(refused({ kind: "dependency", keys: ["SILO-33"] }, ["SILO-33"])).toEqual(["attend SILO-33"]);
  });

  test("stays silent for a startable step, a started one, or no reason", () => {
    expect(notStartableReasons({ startable: true, startReason: null, waitingOn: [] })).toBeNull();
    expect(refused({ kind: "status" }, ["SILO-33"])).toBeNull();
    expect(refused(null)).toBeNull();
  });
});
