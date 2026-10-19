import { afterEach, beforeEach, expect, test } from "bun:test";
import { readProject } from "@kibo/core";
import { type CommandEvent, KIBO_COMMAND, USER_COMMAND } from "../docs";
import { type EventsHarness, eventsHarness, seedFeature } from "./events.test-helper";
import { TRACKED_METHODS, translate } from "./translate";

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

const ADAM = { kind: "human", ref: "adam" } as const;

test("the journal follows removeQuestion", () => {
  expect(TRACKED_METHODS.has("removeQuestion")).toBe(true);
});

test("a removed question is one event on its ticket, named as when it was created", () => {
  const { root, step } = seedFeature(h);
  const question = h.run({
    method: "createQuestion",
    ticketId: step,
    title: "Quota par client : 2 Go ou 5 Go ?",
    createdBy: ADAM,
    importRef: { kind: "import_ref", source: "plan", id: "Q16" },
  }) as { id: string };
  const before = h.journal().length;
  h.run({ method: "removeQuestion", questionId: question.id });
  expect(since(h.journal(), before)).toMatchObject([
    {
      kind: "question_deleted",
      ticketId: step,
      featureId: root,
      source: "user",
      data: { questionId: question.id, title: "Quota par client : 2 Go ou 5 Go ?", ref: "Q16" },
    },
  ]);
});

test("removing a question absent from the state before writes nothing", () => {
  const snapshot = readProject(h.service.docs.project(h.project.id), "2026-10-19");
  const event: CommandEvent = {
    projectId: h.project.id,
    command: { method: "removeQuestion", questionId: "q-gone" },
    result: null,
    meta: USER_COMMAND,
  };
  expect(translate({ before: snapshot, after: snapshot }, [event])).toEqual([]);
});
