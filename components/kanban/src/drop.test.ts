import { expect, test } from "bun:test";
import type { ProjectCommand, StatusId, Ticket } from "@kibo/schema";
import { createMockSdk } from "@kibo/sdk/mock";
import { ORDER_KEY } from "./column-order";
import { commitDrop, type DropEvent, dropInColumn, nextOrder } from "./drop";
import { manifest } from "./index";

const event = (active: string, over: string | null): DropEvent => ({
  active: { id: active },
  over: over === null ? null : { id: over },
});
const columns = { todo: ["a", "b", "c"], in_progress: ["d"], blocked: [] };

test("dropInColumn reads the target column, the side within a column, and inserts above a card of another column", () => {
  expect(dropInColumn(event("a", "c"), columns)).toEqual({
    ticketId: "a",
    statusId: "todo",
    overId: "c",
    place: "after",
  });
  expect(dropInColumn(event("c", "a"), columns)).toMatchObject({ overId: "a", place: "before" });
  expect(dropInColumn(event("a", "d"), columns)).toEqual({
    ticketId: "a",
    statusId: "in_progress",
    overId: "d",
    place: "before",
  });
  expect(dropInColumn(event("a", "blocked"), columns)).toEqual({
    ticketId: "a",
    statusId: "blocked",
    overId: null,
    place: "after",
  });
});

test("dropInColumn ignores a drop outside the board, on itself or on an unknown target", () => {
  expect(dropInColumn(event("a", null), columns)).toBeNull();
  expect(dropInColumn(event("a", "a"), columns)).toBeNull();
  expect(dropInColumn(event("a", "zz"), columns)).toBeNull();
});

const tickets: { id: string; statusId: StatusId }[] = [
  { id: "a", statusId: "todo" },
  { id: "b", statusId: "todo" },
  { id: "d", statusId: "in_progress" },
];

test("nextOrder writes the target column whole, drops the card from its old column, keeps the others", () => {
  const saved = { todo: ["b", "a", "gone"], in_progress: ["d"], done: ["x"] };
  expect(
    nextOrder(saved, tickets, { ticketId: "a", statusId: "in_progress", overId: "d", place: "before" }),
  ).toEqual({
    todo: ["b"],
    in_progress: ["a", "d"],
    done: ["x"],
  });
  expect(nextOrder({}, tickets, { ticketId: "b", statusId: "todo", overId: "a", place: "before" })).toEqual({
    todo: ["b", "a"],
  });
});

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  run({ method: "createTicket", title: "Un" });
  run({ method: "createTicket", title: "Deux" });
  run({ method: "createTicket", title: "Trois", statusId: "in_progress" });
};

test("commitDrop changes the status first, then writes the order from the stored one", async () => {
  const m = createMockSdk(manifest, { seed });
  const [one, two, three] = m.snapshot().tickets as Ticket[];
  if (!one || !two || !three) throw new Error("seed");
  await m.sdk.data.set(ORDER_KEY, { done: ["kept"], todo: [two.id, one.id] });
  const written = await commitDrop(m.sdk, m.snapshot().tickets, {
    ticketId: one.id,
    statusId: "in_progress",
    overId: three.id,
    place: "before",
  });
  expect(m.snapshot().tickets.find((t) => t.id === one.id)?.statusId).toBe("in_progress");
  expect(written).toEqual({ done: ["kept"], todo: [two.id], in_progress: [one.id, three.id] });
  expect(m.data.get(ORDER_KEY)).toEqual(written);
  expect(m.snapshot().tickets.map((t) => t.title)).toEqual(["Un", "Deux", "Trois"]);
});

test("commitDrop passes the reason when the card lands in Bloqué, and ignores a corrupt stored order", async () => {
  const m = createMockSdk(manifest, { seed });
  const one = m.snapshot().tickets[0];
  if (!one) throw new Error("seed");
  await m.sdk.data.set(ORDER_KEY, { todo: "nope", blocked: [1, "x"] });
  const written = await commitDrop(
    m.sdk,
    m.snapshot().tickets,
    { ticketId: one.id, statusId: "blocked", overId: null, place: "after" },
    "Attente client",
  );
  expect(m.snapshot().tickets[0]).toMatchObject({ statusId: "blocked", blockedReason: "Attente client" });
  expect(written).toEqual({ blocked: [one.id] });
});
