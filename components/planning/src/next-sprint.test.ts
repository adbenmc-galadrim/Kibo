import { expect, test } from "bun:test";
import { proposeNextSprint } from "./next-sprint";

const sprint = (code: string, start: string, end: string) => ({ code, start, end });

test("the next sprint follows the last one, on the Monday after its end, with its length", () => {
  const sprints = [
    sprint("S44", "2026-10-26", "2026-10-30"),
    sprint("S42", "2026-10-12", "2026-10-16"),
    sprint("S43", "2026-10-19", "2026-10-23"),
  ];
  expect(proposeNextSprint(sprints, "2026-10-16")).toEqual({
    code: "S45",
    name: "",
    start: "2026-11-02",
    end: "2026-11-06",
  });
});

test("a two-week sprint gives a two-week proposal", () => {
  expect(proposeNextSprint([sprint("S1", "2026-10-19", "2026-10-30")], "2026-10-16")).toMatchObject({
    code: "S2",
    start: "2026-11-02",
    end: "2026-11-13",
  });
});

test("without a sprint: S1, next Monday, five days", () => {
  expect(proposeNextSprint([], "2026-10-16")).toEqual({
    code: "S1",
    name: "",
    start: "2026-10-19",
    end: "2026-10-23",
  });
});

test("the code follows the largest numeric suffix, whatever the prefix", () => {
  const sprints = [
    sprint("Sprint 7", "2026-10-05", "2026-10-09"),
    sprint("Démo", "2026-10-12", "2026-10-16"),
  ];
  expect(proposeNextSprint(sprints, "2026-10-16").code).toBe("S8");
  expect(proposeNextSprint([sprint("Démo", "2026-10-12", "2026-10-16")], "2026-10-16").code).toBe("S1");
});
