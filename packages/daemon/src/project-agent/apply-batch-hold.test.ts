import { afterEach, expect, test } from "bun:test";
import type { ProposedAction } from "@kibo/schema";
import { type ProjectEvents, startProjectEvents } from "../events/bootstrap";
import { openStore, type Store } from "../store";
import { applyBatch } from "./apply-batch";
import { type Harness, HUMAN, harness, propose } from "./fakes.test-helper";

type World = { h: Harness; store: Store; events: ProjectEvents };
const open: World[] = [];
afterEach(() => {
  for (const w of open.splice(0)) {
    w.events.stop();
    w.store.close();
    w.h.close();
  }
});

const why = "";
const REASON = "Serveur MinIO de recette indisponible";

function setup() {
  const h = harness();
  const store = openStore(h.dir);
  const events = startProjectEvents({ store, service: h.service, now: () => 1_000 });
  open.push({ h, store, events });
  const f5 = h.ticket("Saisie hors ligne");
  const step = h.ticket("Écran d'envoi");
  h.command({ method: "moveTicket", ticketId: step.id, parentId: f5.id });
  const apply = async (actions: ProposedAction[], before: () => void = () => undefined) => {
    const batch = await propose(h, actions);
    before();
    const chosen = new Set(actions.map((a) => a.id));
    return applyBatch({ data: h.data, agents: () => h.agents }, batch, chosen, HUMAN);
  };
  const ticket = (id: string) => h.data.project(h.project.id).tickets.find((t) => t.id === id);
  const journal = () => events.store.list({ projectId: h.project.id, limit: 200 }).items.reverse();
  return { h, f5, step, key: step.key ?? "", apply, ticket, journal };
}

test("a hold of the batch takes the day of the daemon and is journaled as the user's", async () => {
  const w = setup();
  const results = await w.apply([{ id: 1, why, type: "setHold", ticket: w.key, reason: REASON }]);
  expect(results.map((r) => r.outcome)).toEqual(["applied"]);
  expect(w.h.commands.at(-1)).toEqual({ method: "setHold", ticketId: w.step.id, reason: REASON });
  expect(w.ticket(w.step.id)?.hold).toEqual({ reason: REASON, since: w.h.service.docs.today() });
  expect(w.journal().at(-1)).toMatchObject({
    kind: "held",
    ticketId: w.step.id,
    featureId: w.f5.id,
    source: "user",
    data: { reason: REASON },
  });
});

test("a feature cannot be held: the proposal is refused", async () => {
  const w = setup();
  const proposal = propose(w.h, [{ id: 1, why, type: "setHold", ticket: w.f5.key ?? "", reason: REASON }]);
  await expect(proposal).rejects.toThrow("hold set on a step, not a feature");
});

test("a step resumed since the proposal is stale and stays resumed", async () => {
  const w = setup();
  w.h.command({ method: "setHold", ticketId: w.step.id, reason: REASON });
  const resumed = () => w.h.command({ method: "setHold", ticketId: w.step.id, reason: null });
  const results = await w.apply(
    [{ id: 1, why, type: "setHold", ticket: w.key, reason: "Accès VPN du client" }],
    resumed,
  );
  expect(results[0]).toMatchObject({ outcome: "stale", detail: "modifié depuis la proposition : hold" });
  expect(w.ticket(w.step.id)?.hold).toBeNull();
});
