import { expect, test } from "bun:test";
import fc from "fast-check";
import { addDays } from "./iso-date";
import {
  currentSprint,
  isLingering,
  nextSprint,
  Sprint,
  SprintPatch,
  sameSprintCode,
  sortSprints,
  sprintState,
} from "./sprint";

const S41 = { id: "s41", code: "S41", name: "Accès", start: "2026-10-05", end: "2026-10-09" };
const S42 = { id: "s42", code: "S42", name: "Terrain hors ligne", start: "2026-10-12", end: "2026-10-16" };
const S43 = { id: "s43", code: "S43", name: "Import et soudures", start: "2026-10-19", end: "2026-10-23" };
const S44 = { id: "s44", code: "S44", name: "Rapports", start: "2026-10-26", end: "2026-10-30" };

test("a sprint has a name of at most 60 characters and ordered ISO dates", () => {
  expect(Sprint.parse(S42)).toEqual(S42);
  expect(Sprint.safeParse({ ...S42, start: "2026-10-17" }).success).toBe(false);
  expect(Sprint.safeParse({ ...S42, name: "x".repeat(61) }).success).toBe(false);
  expect(Sprint.safeParse({ ...S42, name: "   " }).success).toBe(false);
  expect(Sprint.safeParse({ ...S42, start: "2026-1-5" }).success).toBe(false);
  expect(Sprint.safeParse({ ...S42, start: "2026-10-16", end: "2026-10-16" }).success).toBe(true);
});

test("a sprint has a short code of 1 to 8 characters", () => {
  expect(Sprint.parse({ ...S42, code: " S42 " }).code).toBe("S42");
  expect(Sprint.safeParse({ ...S42, code: "" }).success).toBe(false);
  expect(Sprint.safeParse({ ...S42, code: "S42-long1" }).success).toBe(false);
  const { code: _code, ...withoutCode } = S42;
  expect(Sprint.safeParse(withoutCode).success).toBe(false);
  expect(SprintPatch.parse({ code: "S42b" })).toEqual({ code: "S42b" });
  expect(sameSprintCode("s42", " S42 ")).toBe(true);
  expect(sameSprintCode("S42", "S43")).toBe(false);
});

test("a sprint patch is strict and validates each field", () => {
  expect(SprintPatch.parse({ name: " Rapports " })).toEqual({ name: "Rapports" });
  expect(SprintPatch.safeParse({ end: "16/10/2026" }).success).toBe(false);
  expect(SprintPatch.safeParse({ id: "x" }).success).toBe(false);
});

test("the sprint state follows the dates, both bounds included", () => {
  expect(sprintState(S42, "2026-10-11")).toBe("planned");
  expect(sprintState(S42, "2026-10-12")).toBe("current");
  expect(sprintState(S42, "2026-10-16")).toBe("current");
  expect(sprintState(S42, "2026-10-17")).toBe("done");
});

test("sprints sort by start then name", () => {
  const twin = { ...S43, id: "s43b", name: "Abc" };
  expect(sortSprints([S44, S43, twin, S41, S42]).map((s) => s.id)).toEqual([
    "s41",
    "s42",
    "s43b",
    "s43",
    "s44",
  ]);
});

test("the current sprint holds today, else the last finished one, never a future one", () => {
  const overlap = { id: "s42b", code: "S42b", name: "Rattrapage", start: "2026-10-14", end: "2026-10-20" };
  const all = [S41, S42, S43];
  expect(currentSprint(all, "2026-10-16")?.id).toBe("s42");
  expect(currentSprint(all, "2026-10-17")?.id).toBe("s42");
  expect(currentSprint(all, "2026-10-18")?.id).toBe("s42");
  expect(currentSprint(all, "2026-10-19")?.id).toBe("s43");
  expect(currentSprint(all, "2026-10-01")).toBeNull();
  expect(currentSprint([overlap, S42, S43], "2026-10-16")?.id).toBe("s42b");
  expect(currentSprint([S41, S43], "2026-10-16")?.id).toBe("s41");
  expect(currentSprint([S44, S41], "2026-12-01")?.id).toBe("s44");
  expect(currentSprint([], "2026-10-16")).toBeNull();
  expect(nextSprint([S44, S41, S43, S42], "2026-10-16")?.id).toBe("s43");
  expect(nextSprint([S41, S42], "2026-10-16")).toBeNull();
});

test("a finished sprint lingers until the next one starts", () => {
  expect(isLingering(S42, [S41, S42, S43], "2026-10-17")).toBe(true);
  expect(isLingering(S42, [S41, S42, S43], "2026-10-16")).toBe(false);
  expect(isLingering(S41, [S41, S42, S43], "2026-10-17")).toBe(false);
  expect(isLingering(S43, [S41, S42, S43], "2026-10-17")).toBe(false);
});

const isoDay = fc.integer({ min: 0, max: 120 }).map((n) => addDays("2026-09-01", n));
const sprintArb = fc
  .tuple(fc.integer({ min: 0, max: 99 }), isoDay, fc.integer({ min: 0, max: 20 }))
  .map(([n, start, length]) => ({
    id: `s${n}`,
    code: `S${n}`,
    name: `Sprint ${n}`,
    start,
    end: addDays(start, length),
  }));

test("the current sprint holds today or is the most recently finished one", () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(sprintArb, { selector: (s) => s.id, maxLength: 8 }),
      isoDay,
      (sprints, today) => {
        const current = currentSprint(sprints, today);
        const running = sprints.filter((s) => s.start <= today && today <= s.end);
        const finished = sprints.filter((s) => s.end < today);
        if (current === null) {
          expect(running.length + finished.length).toBe(0);
          return;
        }
        if (running.length > 0) {
          expect(running).toContain(current);
          expect(running.every((s) => s.start <= current.start)).toBe(true);
          return;
        }
        expect(finished).toContain(current);
        expect(finished.every((s) => s.end <= current.end)).toBe(true);
      },
    ),
  );
});
