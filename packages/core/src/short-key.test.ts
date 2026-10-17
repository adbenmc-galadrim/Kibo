import { describe, expect, test } from "bun:test";
import type { Ticket } from "@kibo/schema";
import { executeProjectCommand } from "./commands";
import { createProjectDoc, setFeatureSeq } from "./project";
import { allocateShortKey } from "./short-key";
import { getTicket, listTickets } from "./tickets";

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
  });
type Doc = ReturnType<typeof newDoc>;

const ticket = (d: Doc, title: string, parentId?: string) =>
  executeProjectCommand(d, { method: "createTicket", title, parentId }) as Ticket;
const shortKey = (d: Doc, id: string) => getTicket(d, id).shortKey;
const setShortKey = (d: Doc, ticketId: string, value: string | null) =>
  executeProjectCommand(d, { method: "updateTicket", ticketId, shortKey: value });

const commitStates = (d: Doc, run: () => void): [number, string | null][] => {
  const states: [number, string | null][] = [];
  const stop = d.subscribeLocalUpdates(() => {
    const tickets = listTickets(d);
    const root = tickets.find((t) => t.parentId === null);
    states.push([tickets.filter((t) => t.parentId !== null).length, root?.shortKey ?? null]);
  });
  run();
  stop();
  return states;
};

describe("short key", () => {
  test("a root gets F1 in the transaction that gives it its first child, F2 for the next one", () => {
    const d = newDoc();
    const f1 = ticket(d, "Photos");
    expect(shortKey(d, f1.id)).toBeNull();
    const states = commitStates(d, () => ticket(d, "Envoi", f1.id));
    expect(states.filter(([children]) => children > 0)).toEqual([[1, "F1"]]);
    ticket(d, "Relance", f1.id);
    expect(shortKey(d, f1.id)).toBe("F1");
    const f2 = ticket(d, "Rapports");
    ticket(d, "PDF", f2.id);
    expect(shortKey(d, f2.id)).toBe("F2");
    expect(d.getMap("meta").get("featureSeq")).toBe(2);
  });

  test("moving a ticket under a root gives the root its key", () => {
    const d = newDoc();
    const root = ticket(d, "Photos");
    const step = ticket(d, "Envoi");
    const states = commitStates(d, () =>
      executeProjectCommand(d, { method: "moveTicket", ticketId: step.id, parentId: root.id }),
    );
    expect(states).toEqual([[1, "F1"]]);
  });

  test("a nested group gets no key", () => {
    const d = newDoc();
    const root = ticket(d, "Photos");
    const nested = ticket(d, "Envoi", root.id);
    ticket(d, "Compression", nested.id);
    const moved = ticket(d, "Relance");
    executeProjectCommand(d, { method: "moveTicket", ticketId: moved.id, parentId: nested.id });
    expect(shortKey(d, root.id)).toBe("F1");
    expect(shortKey(d, nested.id)).toBeNull();
    expect(allocateShortKey(d, nested.id)).toBeNull();
  });

  test("a key already given by hand is skipped by the allocation", () => {
    const d = newDoc();
    const a = ticket(d, "A");
    setShortKey(d, a.id, "F1");
    const b = ticket(d, "B");
    ticket(d, "b1", b.id);
    expect(shortKey(d, b.id)).toBe("F2");
  });

  test("a key can be changed by hand, must be free and well formed, and can be cleared", () => {
    const d = newDoc();
    const a = ticket(d, "A");
    ticket(d, "a1", a.id);
    const b = ticket(d, "B");
    ticket(d, "b1", b.id);
    expect(() => setShortKey(d, b.id, "F1")).toThrow("CONFLICT");
    expect(() => setShortKey(d, b.id, "f5")).toThrow("INVALID_INPUT");
    expect(shortKey(d, b.id)).toBe("F2");
    setShortKey(d, b.id, "C4");
    expect(shortKey(d, b.id)).toBe("C4");
    setShortKey(d, a.id, "F1");
    expect(shortKey(d, a.id)).toBe("F1");
    setShortKey(d, a.id, null);
    expect(shortKey(d, a.id)).toBeNull();
  });

  test("a refused key leaves the rest of the patch unwritten", () => {
    const d = newDoc();
    const a = ticket(d, "A");
    ticket(d, "a1", a.id);
    const b = ticket(d, "B");
    expect(() =>
      executeProjectCommand(d, { method: "updateTicket", ticketId: b.id, title: "Nouveau", shortKey: "F1" }),
    ).toThrow("CONFLICT");
    d.commit();
    expect(getTicket(d, b.id).title).toBe("B");
  });

  test("a ticket that loses its children keeps its key", () => {
    const d = newDoc();
    const root = ticket(d, "Photos");
    const step = ticket(d, "Envoi", root.id);
    executeProjectCommand(d, { method: "deleteTicket", ticketId: step.id });
    expect(shortKey(d, root.id)).toBe("F1");
    const again = ticket(d, "Relance", root.id);
    expect(shortKey(d, root.id)).toBe("F1");
    expect(shortKey(d, again.id)).toBeNull();
  });

  test("past F999 the allocation is refused and the child is not created", () => {
    const d = newDoc();
    setFeatureSeq(d, 999);
    const root = ticket(d, "Photos");
    expect(() => ticket(d, "Envoi", root.id)).toThrow("INVALID_INPUT");
    d.commit();
    expect(listTickets(d).map((t) => t.title)).toEqual(["Photos"]);
    expect(shortKey(d, root.id)).toBeNull();
  });
});
