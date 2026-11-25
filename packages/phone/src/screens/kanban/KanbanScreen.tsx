import * as kanban from "@kibo/component-kanban";
import type { RemoteClient } from "../../remote-client";
import { ComponentScreen } from "../ComponentScreen";

export function KanbanScreen({ client, projectId }: { client: RemoteClient; projectId: string }) {
  return <ComponentScreen client={client} projectId={projectId} module={kanban} />;
}
