import * as questions from "@kibo/component-questions";
import type { RemoteClient } from "../../remote-client";
import { ComponentScreen } from "../ComponentScreen";

export function QuestionsScreen({ client, projectId }: { client: RemoteClient; projectId: string }) {
  return <ComponentScreen client={client} projectId={projectId} module={questions} />;
}
