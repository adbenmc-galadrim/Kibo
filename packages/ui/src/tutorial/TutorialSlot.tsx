import type { ProjectSnapshot, ProjectSummary, TabTarget, TutorialState } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { copyKeyOf } from "./copy-key";
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

const copyKeyIn = (state: TutorialState, snapshots: ReadonlyMap<string, ProjectSnapshot>): string | null =>
  copyKeyOf(state, (state.projectId && snapshots.get(state.projectId)?.tickets) || []);

export function TutorialSlot({ projects, snapshots, ...p }: Props) {
  const { state } = useTutorial();
  const [closed, setClosed] = useState<{ startedAt: number | null } | null>(null);
  if (!tutorialPanelVisible(state, projects) || closed?.startedAt === state.startedAt) return null;
  const close = () => {
    setClosed({ startedAt: state.startedAt });
    client.rpc({ method: "closeTutorial" }).catch((e: unknown) => console.error("closeTutorial failed", e));
  };
  return <TutorialPanel state={state} copyKey={copyKeyIn(state, snapshots)} {...p} onClose={close} />;
}
