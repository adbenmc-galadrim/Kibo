import { createProjectDoc, getProjectMeta } from "@kibo/core";
import { INBOX_ID, INBOX_KEY, KiboError, type ProjectMeta } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { projectDocId } from "../projects/doc-ids";
import { loadDoc, type Store } from "../store";

export const INBOX_META: ProjectMeta = {
  id: INBOX_ID,
  key: INBOX_KEY,
  name: "Inbox",
  folder: null,
  color: "#64748B",
};

export function loadInbox(store: Store): LoroDoc {
  const stored = loadDoc(store, projectDocId(INBOX_ID));
  if (!stored) return createProjectDoc(INBOX_META);
  if (getProjectMeta(stored).id !== INBOX_ID)
    throw new KiboError("STORE_CORRUPT", "the inbox snapshot describes another project");
  return stored;
}
