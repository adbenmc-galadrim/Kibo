import { COMMAND_WRITES, type ProjectCommand } from "./command";
import type { EntityType } from "./manifest";

export const INBOX_ID = "inbox";
export const INBOX_KEY = "INB";
export const isInbox = (projectId: string): boolean => projectId === INBOX_ID;
export const INBOX_ENTITIES: ReadonlySet<EntityType> = new Set<EntityType>(["ticket", "link"]);
export const inboxAllows = (method: ProjectCommand["method"]): boolean => {
  const writes = COMMAND_WRITES[method];
  return writes !== null && INBOX_ENTITIES.has(writes);
};
export const RESERVED_PROJECT_KEYS: readonly string[] = [INBOX_KEY];
