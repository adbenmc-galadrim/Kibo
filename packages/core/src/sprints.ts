import {
  isFeature,
  isLingering,
  KiboError,
  Sprint,
  type SprintPatch,
  type SprintView,
  sameSprintCode,
  sortSprints,
  sprintState,
  type TicketView,
} from "@kibo/schema";
import type { LoroDoc, LoroTreeNode } from "loro-crdt";
import { stored, valid } from "./config-store";
import { getNode, walkDepthFirst } from "./tree";

type NewSprint = Omit<Sprint, "id">;

const sprintsMap = (doc: LoroDoc) => doc.getMap("sprints");

const parseSprint = (id: string, value: unknown): Sprint => {
  const sprint = stored(Sprint.safeParse(value), `sprint ${id}`);
  if (sprint.id !== id) throw new KiboError("STORE_CORRUPT", `sprint ${id} is stored under another id`);
  return sprint;
};

export function listSprints(doc: LoroDoc): Sprint[] {
  const map = sprintsMap(doc);
  return sortSprints(map.keys().map((id) => parseSprint(id, map.get(id))));
}

function readSprint(doc: LoroDoc, sprintId: string): Sprint {
  const value = sprintsMap(doc).get(sprintId);
  if (value === undefined) throw new KiboError("NOT_FOUND", `sprint ${sprintId} not found`);
  return parseSprint(sprintId, value);
}

function assertFreeCode(doc: LoroDoc, sprint: Sprint): void {
  const taken = listSprints(doc).find((s) => s.id !== sprint.id && sameSprintCode(s.code, sprint.code));
  if (taken !== undefined) throw new KiboError("CONFLICT", `sprint code ${sprint.code} is already taken`);
}

export function createSprint(doc: LoroDoc, input: NewSprint, id: string = crypto.randomUUID()): Sprint {
  const sprint = valid(Sprint.safeParse({ ...input, id }));
  assertFreeCode(doc, sprint);
  sprintsMap(doc).set(id, sprint);
  doc.commit();
  return sprint;
}

export function updateSprint(doc: LoroDoc, sprintId: string, patch: SprintPatch): Sprint {
  const sprint = valid(Sprint.safeParse({ ...readSprint(doc, sprintId), ...patch, id: sprintId }));
  assertFreeCode(doc, sprint);
  sprintsMap(doc).set(sprintId, sprint);
  doc.commit();
  return sprint;
}

export function deleteSprint(doc: LoroDoc, sprintId: string): null {
  readSprint(doc, sprintId);
  for (const node of walkDepthFirst(doc.getTree("tickets")))
    if (node.data.get("sprintId") === sprintId) node.data.set("sprintId", null);
  sprintsMap(doc).delete(sprintId);
  doc.commit();
  return null;
}

function featureLabel(feature: LoroTreeNode): string {
  const shortKey = feature.data.get("shortKey");
  const key = feature.data.get("key");
  if (typeof shortKey === "string") return shortKey;
  return typeof key === "string" ? key : feature.id;
}

export function setTicketSprint(doc: LoroDoc, ticketId: string, sprintId: string | null): void {
  const node = getNode(doc.getTree("tickets"), ticketId);
  const feature = node.parent();
  if (feature !== undefined)
    throw new KiboError(
      "INVALID_INPUT",
      `a step inherits the sprint of its feature: set it on ${featureLabel(feature)}`,
    );
  if (sprintId !== null) readSprint(doc, sprintId);
  node.data.set("sprintId", sprintId);
  doc.commit();
}

export function sprintViews(
  sprints: readonly Sprint[],
  tickets: readonly Pick<TicketView, "id" | "parentId" | "progress" | "sprintId" | "feature">[],
  today: string,
): SprintView[] {
  const features = tickets.filter(isFeature);
  return sortSprints(sprints).map((sprint) => {
    const own = features.filter((t) => t.sprintId === sprint.id);
    return {
      ...sprint,
      state: sprintState(sprint, today),
      features: own.map((t) => t.id),
      delivered: own.filter((t) => t.feature?.status === "delivered").length,
      total: own.length,
      lingering: isLingering(sprint, sprints, today),
    };
  });
}
