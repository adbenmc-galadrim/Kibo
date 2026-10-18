import { describe, expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { emisShapedSnapshot } from "../../fixtures/emis-shaped";
import { desiredCommands, type PlannedCommand, rebaseSetup } from "./desired-new";
import { mapProject } from "./mapping";
import { readOldProject } from "./old-project";
import { featureSprints, planSprints, stepInputs } from "./plan-sprints";
import { TODO_PLACEMENT } from "./todo-placement";

const mapping = mapProject(readOldProject(emisShapedSnapshot()), TODO_PLACEMENT, {});
const schedule = featureSprints(
  planSprints(stepInputs(mapping), 5).slots,
  mapping.features.map((f) => f.shortKey),
);
const commands = desiredCommands(mapping, schedule);
const sent = (c: PlannedCommand): ProjectCommand | null => (c.op === "command" ? c.command : null);
const methods: string[] = commands.map((c) => sent(c)?.method ?? c.op);
const firstIndex = (method: string) => methods.indexOf(method);
const lastIndex = (method: string) => methods.lastIndexOf(method);

describe("desiredCommands", () => {
  test("starts by creating the project with its sprints and no client", () => {
    expect(commands[0]).toEqual({
      op: "createProject",
      name: "Emis",
      key: "EMIS",
      folder: null,
      color: "#F97316",
      client: null,
      setup: rebaseSetup(schedule),
    });
    expect(rebaseSetup(schedule)).toEqual({
      sprintStart: "2026-10-19",
      sprintCount: Math.max(...schedule.map((s) => s.sprint)),
      sprintWeeks: 1,
    });
  });

  test("creates each feature as such, then its steps under it with predicted keys", () => {
    expect(commands[1]).toEqual({
      op: "command",
      command: {
        method: "createTicket",
        title: "Socle",
        feature: true,
        description: "Description fictive de C0.",
      },
      defines: "new:C0",
      expectKey: "F1",
    });
    expect(commands[2]).toEqual({
      op: "command",
      command: {
        method: "createTicket",
        title: "Étape 1 Socle",
        description: "Description fictive de C0-1.",
        labels: ["area:web"],
        parentId: "new:C0",
      },
      defines: "new:C0/1",
      expectKey: "EMIS-1",
    });
    const created = commands.filter((c) => sent(c)?.method === "createTicket");
    expect(created).toHaveLength(15 + 83);
  });

  test("orders the phases: status, refs, optional, delivery, links, questions, sprints", () => {
    const order = [
      "createTicket",
      "setStatus",
      "upsertExternalRef",
      "setTicketOptional",
      "setDeliveryStep",
      "addLink",
      "createQuestion",
      "setTicketSprint",
    ];
    for (const [a, b] of order.slice(1).map((m, i): [string, string] => [order[i] ?? "", m]))
      expect(lastIndex(a)).toBeLessThan(firstIndex(b));
    expect(firstIndex("answerQuestion")).toBeGreaterThan(firstIndex("createQuestion"));
  });

  test("sets status on steps only, with the blocked reason", () => {
    const statuses = commands.flatMap((c) => {
      const cmd = sent(c);
      return cmd?.method === "setStatus" ? [cmd] : [];
    });
    expect(statuses.every((s) => s.ticketId.includes("/"))).toBe(true);
    expect(statuses).toContainEqual({
      method: "setStatus",
      ticketId: "new:C0/6",
      statusId: "blocked",
      reason: "Bloquée : attend le compte d'hébergement.",
    });
  });

  test("delivery goes by key, questions to their new ticket, sprints to the features", () => {
    expect(commands.find((c) => c.op === "setDeliveryStep")).toEqual({
      op: "setDeliveryStep",
      ticketKey: mapping.features[2]?.steps[3]?.newKey ?? "",
      step: 6,
      note: "Code en cours",
      kind: "delivery",
    });
    const data = commands.find((c) => {
      const cmd = sent(c);
      return cmd?.method === "createQuestion" && cmd.importRef?.id === "DATA-1";
    });
    expect(data && sent(data)).toMatchObject({ ticketId: "new:C3", recipient: "client", blocking: true });
    const sprints = commands.flatMap((c) => {
      const cmd = sent(c);
      return cmd?.method === "setTicketSprint" ? [cmd] : [];
    });
    expect(sprints).toHaveLength(schedule.length);
    expect(sprints[0]).toEqual({ method: "setTicketSprint", ticketId: "new:C0", sprintId: "sprint:S1" });
  });

  test("cites no old key: only predicted keys appear", () => {
    const text = JSON.stringify(
      commands.map((c) => (c.op === "command" ? c.command : c.op === "setDeliveryStep" ? c.step : c)),
    );
    expect(text).not.toMatch(/EMIS-\d+/);
    expect(text).not.toContain("assignee");
  });
});
