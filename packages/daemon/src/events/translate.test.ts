import { afterEach, beforeEach, expect, test } from "bun:test";
import { KIBO_COMMAND } from "../docs";
import { type EventsHarness, eventsHarness, seedFeature } from "./events.test-helper";
import { TRACKED_METHODS } from "./translate";

let h: EventsHarness;
beforeEach(() => {
  h = eventsHarness();
});
afterEach(() => h.close());

const REASON = "Serveur MinIO de recette indisponible";
const since = (all: ReturnType<EventsHarness["journal"]>, before: number) => all.slice(before);

test("the journal follows setHold", () => {
  expect(TRACKED_METHODS.has("setHold")).toBe(true);
});

test("a hold, a new reason and a resume are one event each, with the root and the origin", () => {
  const { root, step } = seedFeature(h);
  const before = h.journal().length;
  h.run({ method: "setHold", ticketId: step, reason: REASON });
  h.run({ method: "setHold", ticketId: step, reason: "Accès VPN du client" });
  h.run({ method: "setHold", ticketId: step, reason: null });
  expect(since(h.journal(), before)).toMatchObject([
    { kind: "held", ticketId: step, featureId: root, source: "user", data: { reason: REASON } },
    {
      kind: "held",
      ticketId: step,
      featureId: root,
      source: "user",
      data: { reason: "Accès VPN du client" },
    },
    {
      kind: "resumed",
      ticketId: step,
      featureId: root,
      source: "user",
      data: { reason: "Accès VPN du client" },
    },
  ]);
});

test("a command that changes nothing writes nothing", () => {
  const { step } = seedFeature(h);
  const before = h.journal().length;
  h.run({ method: "setHold", ticketId: step, reason: null });
  h.run({ method: "setHold", ticketId: step, reason: REASON });
  h.run({ method: "setHold", ticketId: step, reason: REASON });
  expect(since(h.journal(), before).map((e) => e.kind)).toEqual(["held"]);
});

test("a hold set by Kibo is written as Kibo", () => {
  const { step } = seedFeature(h);
  h.run({ method: "setHold", ticketId: step, reason: REASON }, KIBO_COMMAND);
  h.run({ method: "setHold", ticketId: step, reason: null }, KIBO_COMMAND);
  expect(h.journal().slice(-2)).toMatchObject([
    { kind: "held", source: "kibo" },
    { kind: "resumed", source: "kibo" },
  ]);
});
