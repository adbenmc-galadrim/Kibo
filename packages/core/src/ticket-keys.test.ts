import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { createProjectDoc, createTicket, listTickets, peekTicketKey, readProject } from "./index";

const meta = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: null,
  color: "#F97316",
  worktree: null,
  storybook: null,
  delivery: null,
  tracking: null,
  description: null,
  client: null,
};

describe("ticket keys", () => {
  test("each new ticket takes the next key of the project", () => {
    const doc = createProjectDoc(meta);
    const a = createTicket(doc, { title: "A" });
    const b = createTicket(doc, { title: "B" });
    expect([a.key, b.key]).toEqual(["KIB-1", "KIB-2"]);
    expect(peekTicketKey(doc)).toBe("KIB-3");
    expect(readProject(doc, "2026-10-16").nextTicketKey).toBe("KIB-3");
  });
});

describe("keys without a gap", () => {
  const numbers = (keys: readonly (string | null)[], pattern: RegExp): number[] =>
    keys.flatMap((key) => {
      const match = key === null ? null : pattern.exec(key);
      return match ? [Number(match[1])] : [];
    });
  const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

  test("features take F1..f and steps KIB-1..m, whatever the mix", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { maxLength: 30 }), (mix) => {
        const doc = createProjectDoc(meta);
        let feature: string | null = null;
        let created = 0;
        for (const isFeature of mix) {
          if (isFeature || feature === null) {
            feature = createTicket(doc, { title: "F", feature: true }).id;
            created += 1;
          } else createTicket(doc, { title: "Étape", parentId: feature });
        }
        const keys = listTickets(doc).map((t) => t.key);
        const steps = numbers(keys, /^KIB-(\d+)$/).sort((a, b) => a - b);
        const features = numbers(keys, /^F(\d+)$/).sort((a, b) => a - b);
        expect(steps).toEqual(range(steps.length));
        expect(features).toEqual(range(created));
        expect(steps.length + features.length).toBe(keys.length);
      }),
    );
  });
});
