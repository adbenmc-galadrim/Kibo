import { expect, test } from "bun:test";
import { formatClock } from "../agents/format";
import { OPEN_OVERLAP, overlapFixture, RESOLVED_AT } from "./fixtures";
import {
  activityCounts,
  chipLabel,
  overlapCounts,
  overlapLinesByRun,
  overlapRole,
  overlapSides,
  overlapState,
  overlapWhat,
} from "./overlap-labels";

test("the state of an overlap reads open, resolved at a time, or ignored", () => {
  expect(overlapState(OPEN_OVERLAP, RESOLVED_AT)).toBe("Ouvert");
  const resolved = overlapFixture({ status: "resolved", resolvedAt: RESOLVED_AT });
  expect(overlapState(resolved, RESOLVED_AT)).toBe(`Réglé ${formatClock(RESOLVED_AT)}`);
  const ignored = overlapFixture({ status: "ignored", ignoredAt: RESOLVED_AT });
  expect(overlapState(ignored, RESOLVED_AT)).toBe("Ignoré");
});

test("a resolution from another day carries its date", () => {
  const resolved = overlapFixture({ status: "resolved", resolvedAt: RESOLVED_AT });
  expect(overlapState(resolved, RESOLVED_AT + 3 * 86_400_000)).toMatch(/^Réglé \d+ \S+ \d{2}:\d{2}$/);
});

test("the role says who factorises and who is reused", () => {
  expect(overlapRole("other")).toBe("à factoriser");
  expect(overlapRole("owner", "bou · livraison · BOU-15")).toBe("repris par bou · livraison · BOU-15");
});

test("the chip and the activity counts speak French plurals", () => {
  expect(chipLabel(1)).toBe("1 recouvrement ouvert");
  expect(chipLabel(2)).toBe("2 recouvrements ouverts");
  expect(activityCounts(1, 0)).toBe("Recouvrements : 1 réglé · 0 ouvert");
  expect(activityCounts(2, 3)).toBe("Recouvrements : 2 réglés · 3 ouverts");
});

test("what overlaps is named by kind", () => {
  expect(overlapWhat(OPEN_OVERLAP.detail)).toEqual({ code: "formatDate", text: "exporté deux fois" });
  expect(overlapWhat({ kind: "file", path: "src/i18n/fr.ts" })).toEqual({
    code: "src/i18n/fr.ts",
    text: "modifié des deux côtés",
  });
  const block = {
    kind: "block" as const,
    ownerPath: "src/http.ts",
    ownerStart: 12,
    otherPath: "src/api/client.ts",
    otherStart: 40,
    lines: 14,
    chars: 400,
  };
  expect(overlapWhat(block)).toEqual({ code: null, text: "14 lignes identiques" });
});

test("the sides put the reader's own file first", () => {
  expect(overlapSides(OPEN_OVERLAP.detail, "other")).toEqual({
    mine: "src/utils/date.ts",
    theirs: "src/lib/format.ts",
  });
  expect(overlapSides(OPEN_OVERLAP.detail, "owner")).toEqual({
    mine: "src/lib/format.ts",
    theirs: "src/utils/date.ts",
  });
  expect(overlapSides({ kind: "file", path: "src/i18n/fr.ts" }, "owner")).toEqual({
    mine: "src/i18n/fr.ts",
    theirs: "src/i18n/fr.ts",
  });
});

test("the counts split resolved and open overlaps, ignored ones aside", () => {
  const list = [
    OPEN_OVERLAP,
    overlapFixture({ id: "o2", status: "resolved", resolvedAt: RESOLVED_AT }),
    overlapFixture({ id: "o3", status: "ignored", ignoredAt: RESOLVED_AT }),
  ];
  expect(overlapCounts(list)).toEqual({ resolved: 1, open: 1 });
  expect(overlapCounts([])).toEqual({ resolved: 0, open: 0 });
});

test("each run of an open overlap gets a line naming the other ticket", () => {
  const runs = [
    { id: "r-bou-12", ticketKey: "BOU-12", label: "bou · livraison · BOU-12" },
    { id: "r-bou-15", ticketKey: "BOU-15", label: "bou · livraison · BOU-15" },
  ];
  const lines = overlapLinesByRun(
    [OPEN_OVERLAP, overlapFixture({ id: "o2", status: "resolved", resolvedAt: RESOLVED_AT })],
    runs,
  );
  expect(lines.get("r-bou-15")).toEqual([{ overlapId: "o1", withKey: "BOU-12" }]);
  expect(lines.get("r-bou-12")).toEqual([{ overlapId: "o1", withKey: "BOU-15" }]);
  expect(overlapLinesByRun([overlapFixture({ ownerRunId: "gone" })], runs).get("r-bou-15")).toEqual([
    { overlapId: "o1", withKey: "gone" },
  ]);
});
