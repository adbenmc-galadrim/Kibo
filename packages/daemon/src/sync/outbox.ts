import { type GithubIssueRef, InstanceSource, type ProjectCommand, type ProjectSnapshot } from "@kibo/schema";
import { z } from "zod";
import type { CommandEvent, CommandInterceptor, IntegrationHost } from "../integrations/types";
import type { SyncStore } from "./sync-store";

const IdOf = z.object({ id: z.string() });
const Ids = z.array(z.string());

function sourceBinding(snap: ProjectSnapshot, instanceId: string | null) {
  if (instanceId === null) return null;
  const instance = snap.instances.find((i) => i.id === instanceId);
  const source = InstanceSource.safeParse(instance?.config.source);
  if (!source.success) return null;
  return snap.bindings.find((b) => b.id === source.data.bindingId) ?? null;
}

export function syncInterceptor(host: IntegrationHost): CommandInterceptor {
  return (projectId, cmd, meta): ProjectCommand => {
    if (cmd.method !== "createTicket" || meta.origin !== "user" || cmd.parentId) return cmd;
    const binding = sourceBinding(host.snapshot(projectId), meta.instanceId);
    if (!binding) return cmd;
    const ref: GithubIssueRef = {
      kind: "github_issue",
      bindingId: binding.id,
      repo: binding.config.repo,
      number: null,
      nodeId: null,
      url: null,
    };
    return {
      method: "importExternalTicket",
      title: cmd.title,
      description: cmd.description,
      statusId: cmd.statusId,
      assignee: cmd.assignee,
      ref,
    };
  };
}

export function outboxObserver(
  store: SyncStore,
  host: IntegrationHost,
  onEnqueue: (projectId: string, bindingId: string) => void,
): (e: CommandEvent) => void {
  const enqueue = (projectId: string, bindingId: string, ticketId: string, op: "create" | "update") => {
    store.enqueue({ bindingId, projectId, ticketId, op }, host.now());
    onEnqueue(projectId, bindingId);
  };
  const dirty = (projectId: string, ticketId: string) => {
    const snap = host.snapshot(projectId);
    const ticket = snap.tickets.find((t) => t.id === ticketId);
    for (const ref of ticket?.externalRefs ?? []) {
      if (
        ref.kind === "github_issue" &&
        ref.url !== null &&
        snap.bindings.some((b) => b.id === ref.bindingId)
      ) {
        enqueue(projectId, ref.bindingId, ticketId, "update");
      }
    }
  };
  return (e) => {
    if (e.meta.origin === "sync") return;
    const c = e.command;
    switch (c.method) {
      case "importExternalTicket":
        if (c.ref.kind === "github_issue" && c.ref.number === null)
          enqueue(e.projectId, c.ref.bindingId, IdOf.parse(e.result).id, "create");
        return;
      case "updateTicket":
        if (c.title !== undefined || c.description !== undefined) dirty(e.projectId, c.ticketId);
        return;
      case "setStatus":
        dirty(e.projectId, c.ticketId);
        return;
      case "deleteTicket": {
        const ids = Ids.parse(e.result);
        store.ignoreTickets(ids);
        store.deleteOutboxOfTickets(ids);
        return;
      }
      default:
        return;
    }
  };
}
