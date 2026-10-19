import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { createProjectDoc } from "./project";
import { createTicket, getTicket, setHold, setStatus, ticketTree } from "./tickets";
import { getNode } from "./tree";

const DAY = "2026-10-16";

const setup = () => {
  const doc = createProjectDoc({
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
  const feature = createTicket(doc, { title: "Envoi hors ligne", feature: true });
  const step = createTicket(doc, { title: "Écran d'envoi hors ligne", parentId: feature.id });
  return { doc, feature, step };
};

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    return error instanceof KiboError ? error.code : String(error);
  }
  return undefined;
};

test("a step put on hold keeps its status and reads its hold back", () => {
  const { doc, step } = setup();
  setStatus(doc, step.id, "in_progress");
  const held = setHold(doc, step.id, "Serveur MinIO de recette indisponible", DAY);
  expect(held.hold).toEqual({ reason: "Serveur MinIO de recette indisponible", since: DAY });
  expect(held.statusId).toBe("in_progress");
  expect(getTicket(doc, step.id).hold).toEqual(held.hold);
});

test("a feature, a hold without its day and a delivered step are refused", () => {
  const { doc, feature, step } = setup();
  expect(codeOf(() => setHold(doc, feature.id, "R", DAY))).toBe("INVALID_INPUT");
  expect(codeOf(() => setHold(doc, step.id, "R"))).toBe("INVALID_INPUT");
  expect(codeOf(() => setHold(doc, step.id, "R", "16/10/2026"))).toBe("INVALID_INPUT");
  expect(codeOf(() => setHold(doc, step.id, "  ", DAY))).toBe("INVALID_INPUT");
  setStatus(doc, step.id, "done");
  expect(codeOf(() => setHold(doc, step.id, "R", DAY))).toBe("INVALID_INPUT");
  expect(getTicket(doc, step.id).hold).toBeNull();
});

test("a new reason keeps the first day, the reason is trimmed", () => {
  const { doc, step } = setup();
  setHold(doc, step.id, "R", DAY);
  expect(setHold(doc, step.id, "  Accès VPN du client ", "2026-10-20").hold).toEqual({
    reason: "Accès VPN du client",
    since: DAY,
  });
});

test("resuming lifts the hold, even on a delivered step", () => {
  const { doc, step } = setup();
  setHold(doc, step.id, "R", DAY);
  setStatus(doc, step.id, "done");
  expect(setHold(doc, step.id, null).hold).toBeNull();
  expect(getTicket(doc, step.id).hold).toBeNull();
});

test("resuming a step that is not on hold changes nothing", () => {
  const { doc, step } = setup();
  const before = doc.version();
  expect(setHold(doc, step.id, null)).toEqual(getTicket(doc, step.id));
  expect(doc.version().compare(before)).toBe(0);
});

test("a corrupt hold is a corrupt store", () => {
  const { doc, step } = setup();
  getNode(ticketTree(doc), step.id).data.set("hold", { reason: 1 });
  expect(codeOf(() => getTicket(doc, step.id))).toBe("STORE_CORRUPT");
});
