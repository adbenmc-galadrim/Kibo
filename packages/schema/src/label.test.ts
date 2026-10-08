import { expect, test } from "bun:test";
import fc from "fast-check";
import { KiboError } from "./errors";
import { groupLabels, LABEL_MAX, LabelName, labelPrefix, normalizeLabels } from "./label";

test("a label is lowercase ascii with : _ . / - and at most 40 characters", () => {
  for (const ok of ["a", "phase:p1", "area:web", "x".repeat(40), "a.b/c_d-e"])
    expect(LabelName.safeParse(ok).success).toBe(true);
  for (const bad of ["", "A", "phase:P1", "a b", ":p1", "x".repeat(41), "é", "-a"])
    expect(LabelName.safeParse(bad).success).toBe(false);
});

test("normalizeLabels trims, dedupes, sorts and refuses the first invalid label", () => {
  expect(normalizeLabels([" b", "a", "a"])).toEqual(["a", "b"]);
  expect(() => normalizeLabels(["a", "Bad", "c"])).toThrow(
    new KiboError("INVALID_INPUT", 'invalid label "Bad"'),
  );
  expect(() => normalizeLabels(Array.from({ length: LABEL_MAX + 1 }, (_, i) => `l${i}`))).toThrow(KiboError);
  fc.assert(
    fc.property(
      fc.array(fc.stringMatching(/^[a-z0-9][a-z0-9:_./-]{0,39}$/), { maxLength: LABEL_MAX }),
      (labels) => {
        const once = normalizeLabels(labels);
        return (
          JSON.stringify(normalizeLabels(once)) === JSON.stringify(once) && new Set(once).size === once.length
        );
      },
    ),
  );
});

test("labels group by prefix, free labels first", () => {
  expect(labelPrefix("phase:p1")).toBe("phase");
  expect(labelPrefix("urgent")).toBeNull();
  expect(groupLabels(["sprint:s2", "urgent", "phase:p1", "phase:p2"])).toEqual([
    { prefix: null, labels: ["urgent"] },
    { prefix: "phase", labels: ["phase:p1", "phase:p2"] },
    { prefix: "sprint", labels: ["sprint:s2"] },
  ]);
});

test("groupLabels accepts the union of a project's labels beyond the per-ticket limit", () => {
  const many = Array.from({ length: LABEL_MAX * 2 }, (_, i) => `area:a${String(i).padStart(2, "0")}`);
  expect(groupLabels(many)).toEqual([{ prefix: "area", labels: many }]);
});
