import * as planning from "@kibo/component-planning";
import { writeBandFolded } from "@kibo/component-planning/held-band";
import { useMemo } from "react";
import { ComponentScreen } from "../ComponentScreen";

const foldedOnceKey = (projectId: string) => `kibo.phone.held-band-folded.${projectId}`;

function foldHeldBandOnce(storage: Storage, projectId: string): void {
  if (storage.getItem(foldedOnceKey(projectId)) !== null) return;
  writeBandFolded(projectId, true);
  storage.setItem(foldedOnceKey(projectId), "1");
}

export function PlanningScreen({ projectId }: { projectId: string }) {
  useMemo(() => foldHeldBandOnce(localStorage, projectId), [projectId]);
  return <ComponentScreen projectId={projectId} module={planning} />;
}
