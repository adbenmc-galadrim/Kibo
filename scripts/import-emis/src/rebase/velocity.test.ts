import { describe, expect, test } from "bun:test";
import { emisShapedSnapshot } from "../../fixtures/emis-shaped";
import { mapProject } from "./mapping";
import { readOldProject } from "./old-project";
import { TODO_PLACEMENT } from "./todo-placement";
import { isoWeek, observedVelocity, repoOf, velocity } from "./velocity";

const weeks = (...counts: number[]) =>
  counts.flatMap((n, i) =>
    Array.from({ length: n }, () => ({ week: `2026-W${String(40 + i).padStart(2, "0")}` })),
  );

describe("velocity", () => {
  test("falls back to 5 without at least two distinct weeks", () => {
    expect(velocity([])).toBe(5);
    expect(velocity(weeks(7))).toBe(5);
    expect(velocity(weeks(3), 4)).toBe(4);
  });

  test("is the floor of merged steps per distinct week, never 0", () => {
    expect(velocity(weeks(3, 3, 3, 2))).toBe(2);
    expect(velocity(weeks(7, 6))).toBe(6);
    expect(velocity(weeks(1, 0, 0, 0, 0, 0, 0, 0).concat(weeks(0, 1)))).toBe(1);
  });
});

describe("isoWeek", () => {
  test("uses the ISO year of the Thursday", () => {
    expect(isoWeek("2026-10-16T12:00:00Z")).toBe("2026-W42");
    expect(isoWeek("2026-10-19T08:00:00Z")).toBe("2026-W43");
    expect(isoWeek("2021-01-03T10:00:00Z")).toBe("2020-W53");
    expect(isoWeek("2024-12-30T10:00:00Z")).toBe("2025-W01");
  });
});

describe("observedVelocity", () => {
  const mapping = mapProject(readOldProject(emisShapedSnapshot()), TODO_PLACEMENT, {});

  test("finds the repository of the PRs", () => {
    expect(repoOf(mapping)).toBe("example/emis-fictif");
  });

  test("counts done steps whose PR is merged, by ISO week", () => {
    const merges = [
      { number: 1, mergedAt: "2026-09-29T10:00:00Z" },
      { number: 2, mergedAt: "2026-09-30T10:00:00Z" },
      { number: 3, mergedAt: "2026-10-07T10:00:00Z" },
      { number: 4, mergedAt: "2026-10-08T10:00:00Z" },
      { number: 11, mergedAt: "2026-10-08T10:00:00Z" },
      { number: 99, mergedAt: "2026-10-08T10:00:00Z" },
    ];
    const seen = observedVelocity(mapping, merges);
    expect(seen.velocity).toBe(2);
    expect(seen.merges.map((m) => m.number)).toEqual([1, 2, 3, 4]);
    expect(seen.source).toBe("gh : 4 étapes fusionnées sur 2 semaines (2026-W40 à 2026-W41)");
  });

  test("says why it falls back", () => {
    expect(observedVelocity(mapping, null)).toEqual({
      velocity: 5,
      merges: [],
      source: "valeur par défaut : fusions non lues (--no-gh ou gh indisponible)",
    });
    const one = observedVelocity(mapping, [{ number: 1, mergedAt: "2026-09-29T10:00:00Z" }]);
    expect(one.source).toBe("valeur par défaut : 1 étape fusionnée sur 1 semaine, moins de deux semaines");
  });
});
