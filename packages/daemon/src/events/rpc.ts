import { isInbox, KiboError, ListProjectEventsInput, type ProjectEventPage } from "@kibo/schema";
import type { Docs } from "../docs";
import type { RpcExtension } from "../rpc-extensions";
import type { EventStore } from "./store";

export type EventsRpcDeps = { events: EventStore; docs: Pick<Docs, "project"> };

export function listProjectEvents(deps: EventsRpcDeps, raw: unknown): ProjectEventPage {
  const parsed = ListProjectEventsInput.safeParse(raw);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `listProjectEvents: ${parsed.error.message}`);
  const { projectId } = parsed.data;
  if (isInbox(projectId)) throw new KiboError("NOT_FOUND", `project ${projectId} has no journal`);
  deps.docs.project(projectId);
  return deps.events.list(parsed.data);
}

export function projectEventsRpc(deps: EventsRpcDeps): RpcExtension {
  return {
    methods: ["listProjectEvents"],
    async handle(req) {
      if (req.method !== "listProjectEvents")
        throw new KiboError("INTERNAL", `${req.method} is not a project events method`);
      return listProjectEvents(deps, req);
    },
  };
}
