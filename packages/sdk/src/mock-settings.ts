import { getProjectMeta, setProjectMeta } from "@kibo/core";
import type { AgentExecution, ComponentSettings, TrackingSettings } from "@kibo/schema";
import { createNotifier } from "./mock-notifier";

export type MockSettings = {
  read(): ComponentSettings;
  subscribe(listener: () => void): () => void;
  setTracking(tracking: TrackingSettings | null): void;
  setAgentExecution(execution: AgentExecution): void;
};

type ProjectDoc = Parameters<typeof getProjectMeta>[0];

export function createMockSettings(
  doc: ProjectDoc,
  initial: AgentExecution,
  projectChanged: () => void,
): MockSettings {
  let execution = initial;
  const config = createNotifier();
  return {
    read: () => ({ tracking: getProjectMeta(doc).tracking, agentExecution: execution }),
    subscribe: config.subscribe,
    setTracking(tracking) {
      setProjectMeta(doc, { tracking });
      projectChanged();
    },
    setAgentExecution(next) {
      execution = next;
      config.emit();
    },
  };
}
