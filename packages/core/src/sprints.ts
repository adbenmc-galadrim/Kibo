import {
  isFeature,
  KiboError,
  Sprint,
  type SprintPatch,
  type SprintView,
  sortSprints,
  sprintState,
  type TicketView,
} from "@kibo/schema";
import { isContainer, type LoroDoc } from "loro-crdt";
import { stored, valid } from "./config-store";
import { getNode, walkDepthFirst } from "./tree";

export type NewSprint = Omit<Sprint, "id">;

export const sprintsMap = (doc: LoroDoc) => doc.getMap("sprints");

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

export function createSprint(doc: LoroDoc, input: NewSprint, id: string = crypto.randomUUID()): Sprint {
  const sprint = valid(Sprint.safeParse({ ...input, id }));
  sprintsMap(doc).set(id, sprint);
  doc.commit();
  return sprint;
}

export function updateSprint(doc: LoroDoc, sprintId: string, patch: SprintPatch): Sprint {
  const sprint = valid(Sprint.safeParse({ ...readSprint(doc, sprintId), ...patch, id: sprintId }));
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

export function setTicketSprint(doc: LoroDoc, ticketId: string, sprintId: string | null): void {
  const node = getNode(doc.getTree("tickets"), ticketId);
  if (node.parent() !== undefined) throw new KiboError("INVALID_INPUT", "sprint set on the root ticket");
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
    };
  });
}

export function sprintsViolation(doc: LoroDoc): string | null {
  const map = sprintsMap(doc);
  for (const id of map.keys()) {
    const value = map.get(id);
    const parsed = isContainer(value) ? null : Sprint.safeParse(value);
    if (parsed === null || !parsed.success || parsed.data.id !== id)
      return `sprint ${id} is not a valid sprint`;
  }
  return null;
}
