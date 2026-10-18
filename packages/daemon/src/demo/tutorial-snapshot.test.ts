import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectMeta, Question, Ticket } from "@kibo/schema";
import { createService } from "../service";
import { openStore, type Store } from "../store";
import { createTutorialSnapshot } from "./tutorial-snapshot";

const dirs: string[] = [];
const stores: Store[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup() {
  const home = mkdtempSync(join(tmpdir(), "kibo-tutorial-snap-"));
  dirs.push(home);
  const store = openStore(home);
  stores.push(store);
  const service = createService(store, { user: "adam" });
  const meta = service.handle({
    method: "createProject",
    name: "Démo Kibo",
    key: "DEMO",
    folder: null,
    color: "#F97316",
  }) as ProjectMeta;
  const run = (command: object) =>
    service.handle({ method: "command", projectId: meta.id, command } as never);
  return { meta, run, snapshot: createTutorialSnapshot({ docs: service.docs }) };
}

test("the snapshot reads the tickets and whether each question is answered", () => {
  const { meta, run, snapshot } = setup();
  const feature = run({ method: "createTicket", title: "Panier", feature: true }) as Ticket;
  const step = run({ method: "createTicket", title: "Paiement", parentId: feature.id }) as Ticket;
  const by = { kind: "human", ref: "adam" };
  const question = run({
    method: "createQuestion",
    ticketId: step.id,
    title: "Carte ?",
    createdBy: by,
  }) as Question;
  const before = snapshot(meta.id);
  expect(before?.tickets.map((t) => [t.id, t.parentId, t.shortKey])).toEqual([
    [feature.id, null, "F1"],
    [step.id, feature.id, null],
  ]);
  expect(before?.questions).toEqual([{ id: question.id, answered: false }]);
  run({ method: "answerQuestion", questionId: question.id, answer: { kind: "text", text: "Oui" }, by });
  expect(snapshot(meta.id)?.questions).toEqual([{ id: question.id, answered: true }]);
});

test("a deleted project has no snapshot", () => {
  const { snapshot } = setup();
  expect(snapshot("gone")).toBeNull();
});
