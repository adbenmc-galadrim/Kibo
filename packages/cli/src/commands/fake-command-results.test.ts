import { describe, expect, test } from "bun:test";
import { Link, Question, Sprint, Ticket } from "@kibo/schema";
import { type FakeState, fakeCommandResult } from "./fake-command-results";
import { fakeDaemon, SPRINTS, TICKETS } from "./tickets-test-kit";

const fresh = (): FakeState => ({ tickets: [...TICKETS], sprints: [...SPRINTS], seq: 0 });

describe("fakeCommandResult", () => {
  test("createTicket returns a valid step and records it", () => {
    const state = fresh();
    const result = fakeCommandResult(
      {
        method: "createTicket",
        title: "Envoi groupé",
        parentId: "f5",
        description: "Détail",
        labels: ["mobile"],
      },
      state,
    );
    const ticket = Ticket.parse(result);
    expect(ticket).toMatchObject({
      id: "t-1",
      key: "SILO-101",
      title: "Envoi groupé",
      description: "Détail",
      parentId: "f5",
      labels: ["mobile"],
      shortKey: null,
    });
    expect(state.tickets.at(-1)).toMatchObject({ id: "t-1", parentId: "f5", effectiveSprintId: "s42" });
  });

  test("feature: true gives the short key F<n>", () => {
    const state = fresh();
    fakeCommandResult({ method: "createTicket", title: "Une", parentId: "f5" }, state);
    const ticket = Ticket.parse(
      fakeCommandResult({ method: "createTicket", title: "Tournée", feature: true }, state),
    );
    expect(ticket).toMatchObject({ id: "t-2", key: "SILO-102", shortKey: "F2", parentId: null });
  });

  test("createSprint, createQuestion and addLink return their object", () => {
    const state = fresh();
    const sprint = Sprint.parse(
      fakeCommandResult(
        { method: "createSprint", code: "S44", name: "Tournée", start: "2026-11-09", end: "2026-11-20" },
        state,
      ),
    );
    expect(sprint).toEqual({
      id: "s-1",
      code: "S44",
      name: "Tournée",
      start: "2026-11-09",
      end: "2026-11-20",
    });
    expect(state.sprints.at(-1)).toMatchObject({ id: "s-1", state: "planned", features: [] });
    const question = Question.parse(
      fakeCommandResult(
        {
          method: "createQuestion",
          ticketId: "a",
          title: "Quel format d'export ?",
          options: ["CSV", "PDF"],
          provisional: "CSV",
          createdBy: { kind: "human", ref: "u-me" },
        },
        state,
      ),
    );
    expect(question).toMatchObject({
      id: "q-2",
      number: 2,
      ticketId: "a",
      options: ["CSV", "PDF"],
      provisional: "CSV",
    });
    const link = Link.parse(
      fakeCommandResult({ method: "addLink", from: "a", to: "b", type: "blocks" }, state),
    );
    expect(link).toEqual({ id: "l-3", from: "a", to: "b", type: "blocks" });
  });

  test("other commands return an empty object", () => {
    expect(
      fakeCommandResult({ method: "setTicketSprint", ticketId: "f7", sprintId: "s43" }, fresh()),
    ).toEqual({});
  });
});

describe("fakeDaemon commands", () => {
  test("the next getProject holds the created ticket", async () => {
    const d = fakeDaemon();
    const projectId = "p-silo";
    await d.client.rpc({
      method: "command",
      projectId,
      command: { method: "createTicket", title: "Tournée", feature: true },
    });
    const snapshot = await d.client.rpc({ method: "getProject", projectId });
    expect(snapshot.tickets.map((t) => t.key)).toContain("SILO-101");
    expect(fakeDaemon().commands()).toEqual([]);
  });

  test("onCommand takes over, undefined falls back to the default result", async () => {
    const d = fakeDaemon(undefined, undefined, {
      onCommand: (command) => (command.method === "addLink" ? { id: "l-x" } : undefined),
    });
    const projectId = "p-silo";
    const link = await d.client.rpc({
      method: "command",
      projectId,
      command: { method: "addLink", from: "a", to: "b", type: "blocks" },
    });
    expect(link).toEqual({ id: "l-x" });
    const ticket = await d.client.rpc({
      method: "command",
      projectId,
      command: { method: "createTicket", title: "Étape", parentId: "f7" },
    });
    expect(ticket).toMatchObject({ id: "t-1", parentId: "f7" });
  });
});
