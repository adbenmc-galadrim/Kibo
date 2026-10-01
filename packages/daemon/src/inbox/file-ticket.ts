import { transferTicket } from "@kibo/core";
import { INBOX_ID, isInbox, KiboError, type RpcRequest } from "@kibo/schema";
import type { Docs } from "../docs";
import type { Store } from "../store";

export type FileTicketDeps = {
  docs: Pick<Docs, "project" | "assertWritable" | "save" | "emit">;
  store: Pick<Store, "transaction">;
  restore(projectId: string): void;
};
export type FileRequest = Extract<RpcRequest, { method: "fileTicket" }>;
export type FiledTicket = { ticketId: string; key: string | null };

function restoreBoth(deps: FileTicketDeps, projectId: string, error: unknown): never {
  try {
    deps.restore(INBOX_ID);
    deps.restore(projectId);
  } catch (failure) {
    throw new AggregateError(
      [error, failure],
      "restoring the inbox and the project after a failed filing failed",
    );
  }
  throw error;
}

export function createFileTicket(deps: FileTicketDeps): (req: FileRequest) => FiledTicket {
  return (req) => {
    if (isInbox(req.projectId))
      throw new KiboError("INVALID_INPUT", "a ticket cannot be filed into the inbox");
    const target = deps.docs.project(req.projectId);
    deps.docs.assertWritable(req.projectId);
    const inbox = deps.docs.project(INBOX_ID);
    let filed: FiledTicket;
    try {
      filed = deps.store.transaction(() => {
        const moved = transferTicket(inbox, target, req.ticketId, req.parentId ?? null);
        deps.docs.save(INBOX_ID);
        deps.docs.save(req.projectId);
        return { ticketId: moved.ticketId, key: moved.key };
      });
    } catch (e) {
      return restoreBoth(deps, req.projectId, e);
    }
    deps.docs.emit({ projectId: INBOX_ID });
    deps.docs.emit({ projectId: req.projectId });
    return filed;
  };
}
