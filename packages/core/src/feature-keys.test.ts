import { describe, expect, test } from "bun:test";
import { featureLabel, KiboError, type ProjectMeta } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import {
  createProjectDoc,
  createTicket,
  executeProjectCommand,
  getTicket,
  moveTicket,
  updateTicket,
} from "./index";

const META: ProjectMeta = {
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
};

const seqOf = (doc: LoroDoc): unknown => doc.getMap("meta").get("ticketSeq");

function code(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof KiboError) return error.code;
    throw error;
  }
  return "OK";
}

describe("feature keys", () => {
  test("a feature created as such takes F<n> and leaves the ticket counter alone", () => {
    const doc = createProjectDoc(META);
    const f1 = createTicket(doc, { title: "Socle", feature: true });
    const f2 = createTicket(doc, { title: "Clients", feature: true });
    expect([f1.key, f1.shortKey, f2.key, f2.shortKey]).toEqual(["F1", "F1", "F2", "F2"]);
    expect(seqOf(doc)).toBe(0);
  });

  test("steps are numbered without a gap", () => {
    const doc = createProjectDoc(META);
    const f1 = createTicket(doc, { title: "Socle", feature: true });
    const a = createTicket(doc, { title: "Étape A", parentId: f1.id });
    const f2 = createTicket(doc, { title: "Clients", feature: true });
    const b = createTicket(doc, { title: "Étape B", parentId: f2.id });
    expect([a.key, b.key]).toEqual(["SILO-1", "SILO-2"]);
    expect(getTicket(doc, f1.id).shortKey).toBe("F1");
  });

  test("a feature is a root", () => {
    const doc = createProjectDoc(META);
    const root = createTicket(doc, { title: "Racine" });
    expect(code(() => createTicket(doc, { title: "F", feature: true, parentId: root.id }))).toBe(
      "INVALID_INPUT",
    );
    const feature = createTicket(doc, { title: "Socle", feature: true });
    expect(code(() => moveTicket(doc, feature.id, root.id))).toBe("INVALID_INPUT");
    expect(getTicket(doc, feature.id).parentId).toBeNull();
  });

  test("an older root keeps its key and gains F<n> with its first child", () => {
    const doc = createProjectDoc(META);
    createTicket(doc, { title: "Socle", feature: true });
    createTicket(doc, { title: "Clients", feature: true });
    const legacy = createTicket(doc, { title: "Ancienne racine" });
    createTicket(doc, { title: "Étape", parentId: legacy.id });
    const after = getTicket(doc, legacy.id);
    expect([after.key, after.shortKey]).toEqual(["SILO-1", "F3"]);
    expect(featureLabel(after)).toBe("F3");
    expect(featureLabel(getTicket(doc, createTicket(doc, { title: "Planning", feature: true }).id))).toBe(
      "F4",
    );
  });

  test("the short key of a feature created as such cannot drift from its key", () => {
    const doc = createProjectDoc(META);
    const feature = createTicket(doc, { title: "Socle", feature: true });
    expect(updateTicket(doc, feature.id, { shortKey: "F1" }).shortKey).toBe("F1");
    expect(code(() => updateTicket(doc, feature.id, { shortKey: "F9" }))).toBe("INVALID_INPUT");
    expect(code(() => updateTicket(doc, feature.id, { shortKey: null }))).toBe("INVALID_INPUT");
  });

  test("the createTicket command forwards the feature flag", () => {
    const doc = createProjectDoc(META);
    const created = executeProjectCommand(doc, { method: "createTicket", title: "Socle", feature: true });
    expect(created).toMatchObject({ key: "F1", shortKey: "F1" });
  });
});
