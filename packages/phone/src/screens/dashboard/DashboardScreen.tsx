import * as overview from "@kibo/component-overview";
import type { RemoteClient } from "../../remote-client";
import { ComponentScreen } from "../ComponentScreen";

export function DashboardScreen({ client, projectId }: { client: RemoteClient; projectId: string }) {
  return <ComponentScreen client={client} projectId={projectId} module={overview} />;
}
