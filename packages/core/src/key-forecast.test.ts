import { describe, expect, test } from "bun:test";
import { type ProposedAction, Ticket } from "@kibo/schema";
import { executeProjectCommand } from "./commands";
import { keyForecast } from "./key-forecast";
import { createProjectDoc } from "./project";
import { commandsFor } from "./project-agent/apply-plan";
import { predictKeys } from "./project-agent/predict-keys";
import { project } from "./project-agent/test-kit";

const newDoc = () =>
  createProjectDoc({
    id: "p1",
    key: "SILO",
    name: "Silo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });
type Doc = ReturnType<typeof newDoc>;

const ticket = (d: Doc, title: string, parentId?: string) =>
  executeProjectCommand(d, { method: "createTicket", title, parentId }) as Ticket;

function seeded(): Doc {
  const d = newDoc();
  const tours = ticket(d, "Tournées");
  ticket(d, "Relevés", tours.id);
  const depot = ticket(d, "Dépôt");
  ticket(d, "Bennes", depot.id);
  ticket(d, "Pesée", depot.id);
  return d;
}

describe("keyForecast", () => {
  test("reads the next ticket key, the next feature slot and the short keys taken", () => {
    expect(keyForecast(seeded())).toEqual({
      nextTicketKey: "SILO-6",
      nextFeatureSeq: 3,
      usedShortKeys: ["F1", "F2"],
    });
  });

  test("predicted keys are the keys the commands give", () => {
    const d = seeded();
    executeProjectCommand(d, { method: "updateTicket", ticketId: ticket(d, "Pris").id, shortKey: "F4" });
    const why = "";
    const actions: ProposedAction[] = [
      { id: 1, why, type: "createTicket", ref: "new:1", title: "Tournée", feature: true },
      { id: 2, why, type: "createTicket", ref: "new:2", title: "Relevé", parent: "new:1" },
      { id: 3, why, type: "createTicket", ref: "new:3", title: "Racine" },
      { id: 4, why, type: "createTicket", ref: "new:4", title: "Sous", parent: "new:3" },
      { id: 5, why, type: "createTicket", ref: "new:5", title: "Facturation", feature: true },
    ];
    const predicted = predictKeys(actions, keyForecast(d));
    const ids: Record<string, string> = {};
    const real: Record<string, string | null> = {};
    for (const action of actions) {
      if (action.type !== "createTicket") continue;
      const [command] = commandsFor(action, ids, { kind: "human", ref: "adam" }, project({}));
      if (command === undefined) throw new Error("no command");
      const created = Ticket.parse(executeProjectCommand(d, command));
      ids[action.ref] = created.id;
      real[action.ref] = created.key;
    }
    expect(real).toEqual({
      "new:1": "F3",
      "new:2": "SILO-7",
      "new:3": "SILO-8",
      "new:4": "SILO-9",
      "new:5": "F6",
    });
    expect(predicted).toEqual(real);
  });
});
