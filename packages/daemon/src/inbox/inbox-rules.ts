import { inboxAllows, isInbox, KiboError, type ProjectCommand, RESERVED_PROJECT_KEYS } from "@kibo/schema";

export function assertInboxCommand(command: ProjectCommand): void {
  if (!inboxAllows(command.method)) throw new KiboError("INVALID_INPUT", "the inbox only holds tickets");
}

export function assertNotInbox(projectId: string, operation: string): void {
  if (isInbox(projectId)) throw new KiboError("INVALID_INPUT", `${operation} is not available for the inbox`);
}

export function assertNotInboxForAgents(projectId: string): void {
  if (isInbox(projectId))
    throw new KiboError("INVALID_INPUT", "inbox tickets cannot be assigned to an agent");
}

export function assertProjectKeyAllowed(key: string): void {
  if (RESERVED_PROJECT_KEYS.includes(key))
    throw new KiboError("INVALID_INPUT", `project key ${key} is reserved`);
}
