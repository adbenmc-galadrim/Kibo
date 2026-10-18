import { expect, test } from "bun:test";
import { LoroDoc } from "loro-crdt";
import { createProjectDoc, createTicket, listTickets, setTicketOptional } from "./index";

const doc = () =>
  createProjectDoc({
    id: "p1",
    key: "SILO",
    name: "Silo",
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

const stepTitles = (d: LoroDoc, featureId: string): string[] =>
  listTickets(d)
    .filter((t) => t.parentId === featureId)
    .map((t) => t.title);

function featureWithDemo(d: LoroDoc) {
  const feature = createTicket(d, { title: "Envoyer les photos", feature: true });
  createTicket(d, { title: "Stockage", parentId: feature.id });
  const demo = createTicket(d, { title: "Démo client", parentId: feature.id });
  setTicketOptional(d, demo.id, true);
  return feature;
}

test("a step added to a feature goes before its last optional step", () => {
  const d = doc();
  const feature = featureWithDemo(d);
  const added = createTicket(d, { title: "Écran hors ligne", parentId: feature.id });
  expect(stepTitles(d, feature.id)).toEqual(["Stockage", "Écran hors ligne", "Démo client"]);
  expect(added.key).toBe("SILO-3");
});

test("a step added after a mandatory last step goes last", () => {
  const d = doc();
  const feature = createTicket(d, { title: "Socle", feature: true });
  createTicket(d, { title: "Stockage", parentId: feature.id });
  createTicket(d, { title: "Démo client", parentId: feature.id });
  createTicket(d, { title: "Écran", parentId: feature.id });
  expect(stepTitles(d, feature.id)).toEqual(["Stockage", "Démo client", "Écran"]);
});

test("steps added on two peers both land before the optional demo and converge", () => {
  const base = doc();
  const feature = featureWithDemo(base);
  const snapshot = base.export({ mode: "snapshot" });
  const a = LoroDoc.fromSnapshot(snapshot);
  a.setPeerId(101);
  const b = LoroDoc.fromSnapshot(snapshot);
  b.setPeerId(202);
  createTicket(a, { title: "Écran A", parentId: feature.id });
  createTicket(b, { title: "Écran B", parentId: feature.id });
  a.import(b.export({ mode: "update" }));
  b.import(a.export({ mode: "update" }));
  const titles = stepTitles(a, feature.id);
  expect(titles).toEqual(stepTitles(b, feature.id));
  expect(titles.at(-1)).toBe("Démo client");
  expect([...titles].sort()).toEqual(["Démo client", "Stockage", "Écran A", "Écran B"].sort());
});
