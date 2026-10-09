import type { AgentsState } from "@kibo/schema";
import { type ReactNode, useCallback } from "react";
import { OpenQuestionsProvider } from "../agents/open-questions";
import { AgentsProvider } from "../state/agents-context";
import type { OpenView } from "./use-open-view";

type Props = { agents: AgentsState | null; openView: OpenView["openView"]; children: ReactNode };

export function AgentsShellProvider({ agents, openView, children }: Props) {
  const openQuestions = useCallback((projectId: string) => openView("questions", projectId), [openView]);
  return (
    <AgentsProvider agents={agents}>
      <OpenQuestionsProvider value={openQuestions}>{children}</OpenQuestionsProvider>
    </AgentsProvider>
  );
}
