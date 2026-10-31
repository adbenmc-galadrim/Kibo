import { getProjectMeta, setProjectMeta } from "@kibo/core";
import type { ComponentSettings, TrackingSettings } from "@kibo/schema";
import { createNotifier } from "./mock-notifier";

type MockSettings = {
  read(): ComponentSettings;
  subscribe(listener: () => void): () => void;
  setTracking(tracking: TrackingSettings | null): void;
};

type ProjectDoc = Parameters<typeof getProjectMeta>[0];

export function createMockSettings(doc: ProjectDoc, projectChanged: () => void): MockSettings {
  const config = createNotifier();
  return {
    read: () => ({ tracking: getProjectMeta(doc).tracking }),
    subscribe: config.subscribe,
    setTracking(tracking) {
      setProjectMeta(doc, { tracking });
      projectChanged();
    },
  };
}
