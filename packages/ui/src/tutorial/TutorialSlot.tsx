import type { ProjectSnapshot, ProjectSummary, TabTarget } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { tutorialPanelVisible, useTutorial } from "./use-tutorial";

const TutorialPanel = lazyPanel(() => import("./TutorialPanel").then((m) => m.TutorialPanel), fr.lazy, {
  fallback: "sr-only",
});

type Props = {
  projects: readonly ProjectSummary[];
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
  activeTarget: TabTarget | null;
  onOpen(target: TabTarget): void;
  onDeleteDemo(projectId: string): void;
};

export function TutorialSlot({ projects, snapshots, ...p }: Props) {
  const { state } = useTutorial();
  const [closed, setClosed] = useState<{ startedAt: number | null } | null>(null);
  if (!tutorialPanelVisible(state, projects) || closed?.startedAt === state.startedAt) return null;
  const pages = (state.projectId && snapshots.get(state.projectId)?.pages) || [];
  return (
    <TutorialPanel
      state={state}
      pages={pages}
      {...p}
      onClose={() => setClosed({ startedAt: state.startedAt })}
    />
  );
}
