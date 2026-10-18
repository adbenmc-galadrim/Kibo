import type { AgentsState } from "@kibo/schema";
import { type ReactNode, useCallback } from "react";
import { OpenQuestionsProvider } from "../agents/open-questions";
import { AgentsProvider } from "../state/agents-context";
import type { OpenView } from "./use-open-view";
import { viewSpotlight } from "./view-spotlight";

type Props = { agents: AgentsState | null; openView: OpenView["openView"]; children: ReactNode };

export function AgentsShellProvider({ agents, openView, children }: Props) {
  const openQuestions = useCallback(
    (projectId: string, questionId?: string) =>
      openView("questions", projectId, viewSpotlight(undefined, questionId)),
    [openView],
  );
  return (
    <AgentsProvider agents={agents}>
      <OpenQuestionsProvider value={openQuestions}>{children}</OpenQuestionsProvider>
    </AgentsProvider>
  );
}
