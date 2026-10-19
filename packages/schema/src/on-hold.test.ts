import { expect, test } from "bun:test";
import type { Hold } from "./hold";
import type { Link } from "./link";
import {
  type HoldSource,
  heldByReason,
  holdSuggestions,
  holdsOf,
  isHeld,
  type OnHold,
  shortReason,
} from "./on-hold";
import type { StatusId } from "./status";

const R: Hold = { reason: "R", since: "2026-10-16" };
const step = (n: number, over: Partial<HoldSource> = {}): HoldSource => ({
  id: String(n),
  key: `SILO-${n}`,
  statusId: "todo",
  hold: null,
  parentId: "f5",
  ...over,
});
const blocks = (from: number, to: number): Pick<Link, "from" | "to" | "type"> => ({
  from: String(from),
  to: String(to),
  type: "blocks",
});
const held = (n: number, statusId: StatusId = "todo") => step(n, { hold: R, statusId });
const own = (key: string): OnHold => ({ source: "own", key, reason: "R", since: "2026-10-16" });
const dependency = (key: string): OnHold => ({ ...own(key), source: "dependency" });

test("a held step is on hold on its own, with its reason and day", () => {
  const holds = holdsOf([held(33, "in_progress"), step(34)], [], "SILO");
  expect([...holds]).toEqual([["33", own("SILO-33")]]);
});

test("the steps after a held step along blocks links wait for it", () => {
  const holds = holdsOf([held(33), step(34), step(35)], [blocks(33, 34), blocks(34, 35)], "SILO");
  expect(holds.get("34")).toEqual(dependency("SILO-33"));
  expect(holds.get("35")).toEqual(dependency("SILO-33"));
});

test("a feature is never on hold, even when a link targets it or it carries a hold", () => {
  const feature = step(5, { parentId: null });
  expect(holdsOf([held(33), feature], [blocks(33, 5)], "SILO").has("5")).toBe(false);
  expect(holdsOf([step(5, { parentId: null, hold: R })], [], "SILO").size).toBe(0);
});

test("only a held step propagates, not a link between features", () => {
  const f4 = step(4, { parentId: null, hold: R });
  expect(holdsOf([f4, step(41, { parentId: "4" })], [blocks(4, 41)], "SILO").size).toBe(0);
});

test("a relates link does not propagate", () => {
  const holds = holdsOf([held(33), step(34)], [{ from: "33", to: "34", type: "relates" }], "SILO");
  expect(holds.has("34")).toBe(false);
});

test("a delivered step is never on hold and does not hold anyone", () => {
  expect(holdsOf([held(33, "done"), step(34)], [blocks(33, 34)], "SILO").size).toBe(0);
  const through = holdsOf(
    [held(33), step(34, { statusId: "done" }), step(35)],
    [blocks(33, 34), blocks(34, 35)],
    "SILO",
  );
  expect([...through.keys()]).toEqual(["33"]);
});

test("a cycle of blocks links terminates", () => {
  const holds = holdsOf([held(33), step(34)], [blocks(33, 34), blocks(34, 33)], "SILO");
  expect(holds.get("33")).toEqual(own("SILO-33"));
  expect(holds.get("34")).toEqual(dependency("SILO-33"));
});

test("with two sources, the smallest key wins", () => {
  const holds = holdsOf([held(33), held(31), step(34)], [blocks(33, 34), blocks(31, 34)], "SILO");
  expect(holds.get("34")?.key).toBe("SILO-31");
  const wide = holdsOf([held(100), held(9), step(34)], [blocks(100, 34), blocks(9, 34)], "SILO");
  expect(wide.get("34")?.key).toBe("SILO-9");
});

test("its own hold wins over a hold upstream", () => {
  const holds = holdsOf(
    [held(33), step(34, { hold: { reason: "S", since: "2026-10-17" } })],
    [blocks(33, 34)],
    "SILO",
  );
  expect(holds.get("34")).toEqual({ source: "own", key: "SILO-34", reason: "S", since: "2026-10-17" });
});

test("a step without a key is named by its pending label", () => {
  const holds = holdsOf([step(33, { key: null, hold: R })], [], "SILO");
  expect(holds.get("33")?.key).toBe("SILO-…");
});

test("isHeld reads the derived hold", () => {
  expect(isHeld({ onHold: null })).toBe(false);
  expect(isHeld({ onHold: own("SILO-33") })).toBe(true);
});

test("suggestions: current reasons by frequency, then the journal, six at most", () => {
  expect(holdSuggestions(["B", "A", "B", null], ["C", "A", "D", "E", "F", "G"])).toEqual([
    "B",
    "A",
    "C",
    "D",
    "E",
    "F",
  ]);
  expect(holdSuggestions(["Z", "A"], [], 1)).toEqual(["A"]);
});

test("held steps are grouped by first day then reason, with their dependents", () => {
  const minio = { reason: "MinIO", since: "2026-10-16" };
  const tickets = [
    { id: "82", onHold: { source: "own" as const, key: "SILO-82", ...minio } },
    { id: "45", onHold: { source: "own" as const, key: "SILO-45", reason: "Règle", since: "2026-10-17" } },
    { id: "33", onHold: { source: "own" as const, key: "SILO-33", ...minio } },
    { id: "34", onHold: { source: "dependency" as const, key: "SILO-33", ...minio } },
    { id: "35", onHold: { source: "dependency" as const, key: "SILO-33", ...minio } },
    { id: "31", onHold: null },
  ];
  const groups = heldByReason(tickets);
  expect(
    groups.map((g) => ({ reason: g.reason, steps: g.steps.map((s) => s.id), dependents: g.dependents })),
  ).toEqual([
    { reason: "MinIO", steps: ["33", "82"], dependents: 2 },
    { reason: "Règle", steps: ["45"], dependents: 0 },
  ]);
});

test("a short reason keeps 24 characters and an ellipsis", () => {
  expect(shortReason("Serveur MinIO de recette indisponible")).toBe("Serveur MinIO de recette…");
  expect(shortReason("Accès VPN du client")).toBe("Accès VPN du client");
  expect(shortReason("x".repeat(24))).toBe("x".repeat(24));
  expect(shortReason("abcde fghij", 6)).toBe("abcde…");
});
