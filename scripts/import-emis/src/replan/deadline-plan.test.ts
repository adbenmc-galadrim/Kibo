import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { type LiveProject, planToDeadline } from "./deadline-plan";

const sprint = (n: number, start: string, end: string) => ({ id: `s${n}`, code: `S${n}`, start, end });
const ticket = (
  key: string,
  parentId: string | null,
  patch: Partial<LiveProject["tickets"][number]> = {},
): LiveProject["tickets"][number] => ({
  id: `t-${key}`,
  key,
  parentId,
  statusId: "todo",
  optional: false,
  sprintId: null,
  ...patch,
});

const live: LiveProject = {
  sprints: [
    sprint(1, "2026-10-19", "2026-10-23"),
    sprint(2, "2026-10-26", "2026-10-30"),
    sprint(3, "2026-11-02", "2026-11-06"),
    sprint(4, "2026-11-09", "2026-11-13"),
  ],
  tickets: [
    ticket("F1", null, { sprintId: "s4" }),
    ticket("EMIS-1", "t-F1", { statusId: "done" }),
    ticket("EMIS-2", "t-F1"),
    ticket("EMIS-3", "t-F1", { optional: true }),
    ticket("EMIS-4", "t-F1"),
    ticket("F2", null, { sprintId: "s4" }),
    ticket("EMIS-5", "t-F2"),
    ticket("EMIS-6", "t-F2"),
    ticket("EMIS-7", "t-F2"),
  ],
  links: [],
};

describe("planToDeadline", () => {
  test("keeps the sprints that start by the deadline, at an even capacity", () => {
    const plan = planToDeadline(live, "2026-11-05");
    expect(plan.remaining).toBe(5);
    expect(plan.capacity).toBe(2);
    expect(plan.sprints.map((s) => `${s.code} ${s.start}→${s.end}`)).toEqual([
      "S1 2026-10-19→2026-10-23",
      "S2 2026-10-26→2026-10-30",
      "S3 2026-11-02→2026-11-05",
    ]);
    expect(plan.features).toEqual([
      { key: "F1", from: "S4", to: "S1" },
      { key: "F2", from: "S4", to: "S3" },
    ]);
  });

  test("moves features, shortens the last sprint and deletes the later ones", () => {
    expect(planToDeadline(live, "2026-11-05").commands).toEqual([
      { method: "setTicketSprint", ticketId: "t-F1", sprintId: "s1" },
      { method: "setTicketSprint", ticketId: "t-F2", sprintId: "s3" },
      { method: "updateSprint", sprintId: "s3", patch: { end: "2026-11-05" } },
      { method: "deleteSprint", sprintId: "s4" },
    ]);
  });

  test("a blocking step from another feature is planned first", () => {
    const blocked: LiveProject = { ...live, links: [{ from: "t-EMIS-7", to: "t-EMIS-2", type: "blocks" }] };
    const order = planToDeadline(blocked, "2026-11-05").steps.map((s) => s.key);
    expect(order.indexOf("EMIS-7")).toBeLessThan(order.indexOf("EMIS-2"));
  });

  test("refuses a deadline before the first sprint, or a step left in a deleted sprint", () => {
    expect(() => planToDeadline(live, "2026-10-16")).toThrow(KiboError);
    const stray: LiveProject = {
      ...live,
      tickets: [...live.tickets, ticket("EMIS-8", "t-F2", { sprintId: "s4" })],
    };
    expect(() => planToDeadline(stray, "2026-11-05")).toThrow("EMIS-8");
  });
});
