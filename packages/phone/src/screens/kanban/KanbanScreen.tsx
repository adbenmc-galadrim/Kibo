import * as kanban from "@kibo/component-kanban";
import { ComponentScreen } from "../ComponentScreen";

export function KanbanScreen({ projectId }: { projectId: string }) {
  return <ComponentScreen projectId={projectId} module={kanban} />;
}
