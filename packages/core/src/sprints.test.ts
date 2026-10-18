import { describe, expect, test } from "bun:test";
import type { Sprint, Ticket } from "@kibo/schema";
import { executeProjectCommand, readProject } from "./commands";
import { createProjectDoc } from "./project";
import { listSprints, sprintViews } from "./sprints";
import { getTicket } from "./tickets";

const newDoc = () =>
  createProjectDoc({
    id: "p1",
    key: "EMIS",
    name: "Emis",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });
type Doc = ReturnType<typeof newDoc>;

const sprint = (d: Doc, name: string, start: string, end: string, code = name) =>
  executeProjectCommand(d, { method: "createSprint", code, name, start, end }) as Sprint;
const ticket = (d: Doc, title: string, parentId?: string) =>
  executeProjectCommand(d, { method: "createTicket", title, parentId }) as Ticket;
const assign = (d: Doc, ticketId: string, sprintId: string | null) =>
  executeProjectCommand(d, { method: "setTicketSprint", ticketId, sprintId }) as Ticket;
const done = (d: Doc, ticketId: string) =>
  executeProjectCommand(d, { method: "setStatus", ticketId, statusId: "done" });

describe("sprint commands", () => {
  test("a created sprint is an entry of the sprints map, listed by start then name", () => {
    const d = newDoc();
    const s43 = sprint(d, "S43", "2026-10-19", "2026-10-23");
    const s42 = sprint(d, "S42", "2026-10-12", "2026-10-16");
    const s42b = sprint(d, "S42 bis", "2026-10-12", "2026-10-14");
    expect(d.getMap("sprints").get(s43.id)).toEqual(s43);
    expect(listSprints(d).map((s) => s.name)).toEqual(["S42", "S42 bis", "S43"]);
    expect(s42b.id).not.toBe(s42.id);
  });

  test("a sprint code is unique in the project, case ignored", () => {
    const d = newDoc();
    const s42 = sprint(d, "Terrain hors ligne", "2026-10-12", "2026-10-16", "S42");
    const s43 = sprint(d, "Import et soudures", "2026-10-19", "2026-10-23", "S43");
    expect(() => sprint(d, "Autre", "2026-10-19", "2026-10-23", "s42")).toThrow("CONFLICT");
    const rename = (sprintId: string, code: string) =>
      executeProjectCommand(d, { method: "updateSprint", sprintId, patch: { code } });
    expect(() => rename(s43.id, " S42 ")).toThrow("CONFLICT");
    expect(rename(s42.id, "s42")).toMatchObject({ code: "s42" });
    expect(listSprints(d).map((s) => s.code)).toEqual(["s42", "S43"]);
  });

  test("a sprint whose end is before its start is refused", () => {
    expect(() => sprint(newDoc(), "S42", "2026-10-16", "2026-10-12")).toThrow("INVALID_INPUT");
  });

  test("updating a sprint changes only the given fields and keeps it valid", () => {
    const d = newDoc();
    const s42 = sprint(d, "S42", "2026-10-12", "2026-10-16");
    const updated = executeProjectCommand(d, {
      method: "updateSprint",
      sprintId: s42.id,
      patch: { end: "2026-10-17" },
    });
    expect(updated).toEqual({ ...s42, end: "2026-10-17" });
    expect(listSprints(d)).toEqual([{ ...s42, end: "2026-10-17" }]);
    expect(() =>
      executeProjectCommand(d, { method: "updateSprint", sprintId: s42.id, patch: { start: "2026-10-20" } }),
    ).toThrow("INVALID_INPUT");
    expect(() =>
      executeProjectCommand(d, { method: "updateSprint", sprintId: "nope", patch: { name: "S" } }),
    ).toThrow("NOT_FOUND");
  });

  test("deleting a sprint sends its features back to planning in the same transaction", () => {
    const d = newDoc();
    const s42 = sprint(d, "S42", "2026-10-12", "2026-10-16");
    const f5 = ticket(d, "Photos");
    ticket(d, "Envoi", f5.id);
    assign(d, f5.id, s42.id);
    let commits = 0;
    const stop = d.subscribeLocalUpdates(() => {
      commits += 1;
    });
    expect(executeProjectCommand(d, { method: "deleteSprint", sprintId: s42.id })).toBeNull();
    stop();
    expect(commits).toBe(1);
    expect(getTicket(d, f5.id).sprintId).toBeNull();
    expect(listSprints(d)).toEqual([]);
    expect(() => executeProjectCommand(d, { method: "deleteSprint", sprintId: s42.id })).toThrow("NOT_FOUND");
  });

  test("a sprint is set on the root ticket only, and must exist", () => {
    const d = newDoc();
    const s42 = sprint(d, "S42", "2026-10-12", "2026-10-16");
    const f5 = ticket(d, "Photos");
    const step = ticket(d, "Envoi", f5.id);
    expect(assign(d, f5.id, s42.id).sprintId).toBe(s42.id);
    expect(() => assign(d, step.id, s42.id)).toThrow("sprint set on the root ticket");
    expect(() => assign(d, step.id, s42.id)).toThrow("INVALID_INPUT");
    expect(() => assign(d, f5.id, "unknown")).toThrow("NOT_FOUND");
    expect(assign(d, f5.id, null).sprintId).toBeNull();
  });
});

describe("sprint views", () => {
  test("list the features of each sprint by rank, count the delivered ones, and date the state", () => {
    const d = newDoc();
    const s41 = sprint(d, "S41", "2026-10-05", "2026-10-09");
    const s42 = sprint(d, "S42", "2026-10-12", "2026-10-16");
    const s43 = sprint(d, "S43", "2026-10-19", "2026-10-23");
    const f1 = ticket(d, "F1");
    done(d, ticket(d, "a", f1.id).id);
    const f2 = ticket(d, "F2");
    ticket(d, "b", f2.id);
    const solo = ticket(d, "Seul");
    for (const f of [f2, f1, solo]) assign(d, f.id, s42.id);
    const views = sprintViews(listSprints(d), readProject(d, "2026-10-16").tickets, "2026-10-14");
    expect(views.map((s) => [s.name, s.state])).toEqual([
      ["S41", "done"],
      ["S42", "current"],
      ["S43", "planned"],
    ]);
    expect(views[1]).toEqual({
      ...s42,
      state: "current",
      features: [f1.id, f2.id],
      delivered: 1,
      total: 2,
      lingering: false,
    });
    expect(views[0]).toMatchObject({ id: s41.id, features: [], delivered: 0, total: 0 });
    expect(views[2]?.id).toBe(s43.id);
  });

  test("the snapshot carries the sprint views dated by the given day", () => {
    const d = newDoc();
    const s42 = sprint(d, "S42", "2026-10-12", "2026-10-16");
    expect(readProject(d, "2026-10-17").sprints).toEqual([
      { ...s42, state: "done", features: [], delivered: 0, total: 0, lingering: true },
    ]);
  });
});
