import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { formatOf, parsePlanText } from "./plan-file";

const YAML_PLAN = `
summary: Tournée et dépôt
actions:
  - type: createTicket
    ref: new:1
    title: Tournée et dépôt
    feature: true
  - type: createTicket
    ref: new:2
    title: Lire le fichier
    parent: new:1
`;

const JSON_PLAN = JSON.stringify({
  summary: "Tournée et dépôt",
  actions: [
    { type: "createTicket", ref: "new:1", title: "Tournée et dépôt", feature: true },
    { type: "createTicket", ref: "new:2", title: "Lire le fichier", parent: "new:1" },
  ],
});

function failure(run: () => unknown): KiboError {
  try {
    run();
  } catch (e) {
    if (e instanceof KiboError) return e;
    throw e;
  }
  throw new Error("expected a KiboError");
}

describe("parsePlanText", () => {
  test("YAML and JSON give the same plan", () => {
    const fromYaml = parsePlanText(YAML_PLAN, "yaml");
    expect(parsePlanText(JSON_PLAN, "json")).toEqual(fromYaml);
    expect(parsePlanText(JSON_PLAN, "yaml")).toEqual(fromYaml);
    expect(fromYaml.summary).toBe("Tournée et dépôt");
  });

  test("missing ids are the positions and a missing why is empty", () => {
    const { actions } = parsePlanText(YAML_PLAN, "yaml");
    expect(actions.map((a) => [a.id, a.why])).toEqual([
      [1, ""],
      [2, ""],
    ]);
    expect(actions[0]).toMatchObject({ type: "createTicket", feature: true, ref: "new:1" });
  });

  test("given ids and why are kept", () => {
    const text = JSON.stringify({
      actions: [
        { id: 7, why: "pour voir", type: "addRecipient", name: "client" },
        { id: 3, type: "addRecipient", name: "dsi" },
      ],
    });
    expect(parsePlanText(text, "json").actions.map((a) => [a.id, a.why])).toEqual([
      [7, "pour voir"],
      [3, ""],
    ]);
  });

  test("the summary is optional", () => {
    const text = JSON.stringify({ actions: [{ type: "addRecipient", name: "client" }] });
    expect(parsePlanText(text, "json").summary).toBeNull();
  });

  test("mixed ids are refused", () => {
    const text = JSON.stringify({
      actions: [
        { id: 1, type: "addRecipient", name: "a" },
        { type: "addRecipient", name: "b" },
      ],
    });
    const e = failure(() => parsePlanText(text, "json"));
    expect(e.code).toBe("INVALID_INPUT");
    expect(e.detail).toBe("plan: give every action an id, or none");
  });

  test("an empty or missing action list is refused", () => {
    for (const text of ['{"actions":[]}', '{"summary":"x"}', "[]", "42"]) {
      const e = failure(() => parsePlanText(text, "json"));
      expect(e.code).toBe("INVALID_INPUT");
      expect(e.detail).toBe("plan: actions must be a non-empty list");
    }
  });

  test("more than 500 actions are refused", () => {
    const actions = Array.from({ length: 501 }, () => ({ type: "addRecipient", name: "a" }));
    const e = failure(() => parsePlanText(JSON.stringify({ actions }), "json"));
    expect(e.code).toBe("INVALID_INPUT");
    expect(e.detail).toBe("plan: at most 500 actions");
  });

  test("a type outside the plan is refused with its position", () => {
    const text = JSON.stringify({
      actions: [
        { type: "addRecipient", name: "a" },
        { type: "assignAgent", ticket: "SILO-1", profileId: "dev" },
      ],
    });
    const e = failure(() => parsePlanText(text, "json"));
    expect(e.code).toBe("VALIDATION_FAILED");
    expect(e.detail).toBe("action 2: type assignAgent is not allowed in a plan");
  });

  test("every faulty action is listed, one line each", () => {
    const text = JSON.stringify({
      actions: [
        { type: "createTicket", ref: "new:1", title: "" },
        { type: "addRecipient", name: "a" },
        { type: "link", from: "SILO-1" },
      ],
    });
    const e = failure(() => parsePlanText(text, "json"));
    expect(e.code).toBe("VALIDATION_FAILED");
    const lines = e.detail.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("action 1: title String must contain at least 1 character(s)");
    expect(lines[1]).toStartWith("action 3: ");
    expect(lines[1]).toContain("; kind ");
  });

  test("an unreadable text is refused with the parser message", () => {
    const yaml = failure(() => parsePlanText("actions: [", "yaml"));
    expect(yaml.code).toBe("INVALID_INPUT");
    expect(yaml.detail).toStartWith("plan unreadable: ");
    const json = failure(() => parsePlanText("{", "json"));
    expect(json.detail).toStartWith("plan unreadable: ");
  });

  test("YAML anchors and literal blocks are read", () => {
    const text = `
actions:
  - type: createTicket
    ref: new:1
    title: &titre Lire le fichier
    description: |
      Première ligne
      Seconde ligne
  - type: createQuestion
    ticket: new:1
    title: *titre
`;
    const { actions } = parsePlanText(text, "yaml");
    expect(actions[0]).toMatchObject({ description: "Première ligne\nSeconde ligne\n" });
    expect(actions[1]).toMatchObject({ title: "Lire le fichier" });
  });
});

describe("formatOf", () => {
  test(".json is JSON, anything else is YAML", () => {
    expect(formatOf("plan.json")).toBe("json");
    expect(formatOf("dossier/Plan.JSON")).toBe("json");
    expect(formatOf("plan.yaml")).toBe("yaml");
    expect(formatOf("plan.yml")).toBe("yaml");
    expect(formatOf("plan")).toBe("yaml");
  });
});
