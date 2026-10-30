import { getKeyAllocator, restoreLocalAllocation, walkDepthFirst } from "@kibo/core";
import type { ProjectEventSink } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import type { Docs } from "../docs";
import type { ProjectSettings } from "../notes/settings";

export const LOCAL_KEYS_MARKER = "localKeysRestoredAt";

type Allocated = { ticketId: string; key: string };

function forgetSharing(doc: LoroDoc): void {
  for (const node of walkDepthFirst(doc.getTree("tickets"))) {
    if (typeof node.data.get("pendingSeq") === "number") node.data.set("pendingSeq", null);
  }
  doc.getMap("meta").delete("members");
  doc.commit();
}

export function restoreLocalKeysOnce(
  doc: LoroDoc,
  settings: Pick<ProjectSettings, "get" | "set">,
  projectId: string,
  now: () => number,
): Allocated[] | null {
  if (settings.get(projectId, LOCAL_KEYS_MARKER) !== null) return null;
  const server = getKeyAllocator(doc) === "server";
  const allocated = server ? restoreLocalAllocation(doc) : [];
  if (server || doc.getMap("meta").get("members") !== undefined) forgetSharing(doc);
  settings.set(projectId, LOCAL_KEYS_MARKER, new Date(now()).toISOString());
  return allocated;
}

export type LocalKeysDeps = {
  docs: Pick<Docs, "project" | "projectIds" | "save" | "emit">;
  settings: Pick<ProjectSettings, "get" | "set">;
  sink: ProjectEventSink;
  now: () => number;
};

export function restoreLocalKeys(deps: LocalKeysDeps): void {
  for (const projectId of deps.docs.projectIds()) {
    const doc = deps.docs.project(projectId);
    const before = JSON.stringify(doc.frontiers());
    const allocated = restoreLocalKeysOnce(doc, deps.settings, projectId, deps.now);
    if (allocated === null || JSON.stringify(doc.frontiers()) === before) continue;
    deps.docs.save(projectId);
    deps.docs.emit({ projectId });
    deps.sink.record(projectId, {
      kind: "keys_assigned",
      ticketId: null,
      featureId: null,
      source: "kibo",
      data: { count: allocated.length },
    });
  }
}
