import { afterEach, beforeEach, expect, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { type EventsHarness, eventsHarness } from "./events.test-helper";
import { listProjectEvents } from "./rpc";

let h: EventsHarness;
beforeEach(() => {
  h = eventsHarness();
});
afterEach(() => h.close());

const list = (req: Partial<Extract<RpcRequest, { method: "listProjectEvents" }>>) =>
  h.events.rpc.handle(
    { method: "listProjectEvents", projectId: h.project.id, limit: 50, ...req },
    LOCAL_CONTEXT,
  );
const deps = () => ({ events: h.events.store, docs: h.service.docs });

test("listProjectEvents pages the journal of a project", async () => {
  h.ticket("A");
  h.run({
    method: "createSprint",
    code: "S42",
    name: "Saisie hors ligne",
    start: "2026-10-12",
    end: "2026-10-16",
  });
  h.run({ method: "createSprint", code: "S43", name: "Clôture", start: "2026-10-19", end: "2026-10-23" });
  expect(h.events.rpc.methods).toEqual(["listProjectEvents"]);
  const page = await list({ limit: 1 });
  expect(page).toMatchObject({ items: [{ kind: "sprint_created", data: { code: "S43" } }] });
  const nextBefore = listProjectEvents(deps(), { projectId: h.project.id, limit: 1 }).nextBefore ?? undefined;
  expect(await list({ before: nextBefore })).toMatchObject({
    items: [{ data: { code: "S42" } }],
    nextBefore: null,
  });
});

test("a page larger than 200 events or an unknown project is refused", async () => {
  expect(() => listProjectEvents(deps(), { projectId: h.project.id, limit: 201 })).toThrow(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
  await expect(list({ projectId: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
});
