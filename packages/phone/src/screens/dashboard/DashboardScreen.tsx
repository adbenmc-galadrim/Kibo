import * as overview from "@kibo/component-overview";
import { ComponentScreen } from "../ComponentScreen";

export function DashboardScreen({ projectId }: { projectId: string }) {
  return <ComponentScreen projectId={projectId} module={overview} />;
}
