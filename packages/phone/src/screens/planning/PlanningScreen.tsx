import * as planning from "@kibo/component-planning";
import { writeBandFolded } from "@kibo/component-planning/held-band";
import { useEffect, useRef, useState } from "react";
import { ComponentScreen } from "../ComponentScreen";

const foldedOnceKey = (projectId: string) => `kibo.phone.held-band-folded.${projectId}`;
const CURRENT_SPRINT = 'section[data-state="current"]';

function foldHeldBandOnce(storage: Storage, projectId: string): void {
  if (storage.getItem(foldedOnceKey(projectId)) !== null) return;
  writeBandFolded(projectId, true);
  storage.setItem(foldedOnceKey(projectId), "1");
}

function useOpenOnCurrentSprint(projectId: string) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = frame.current;
    if (!root || !projectId) return;
    const reveal = (): boolean => {
      const current = root.querySelector(CURRENT_SPRINT);
      current?.scrollIntoView({ inline: "start", block: "nearest" });
      return current !== null;
    };
    if (reveal()) return;
    const watcher = new MutationObserver(() => {
      if (reveal()) watcher.disconnect();
    });
    watcher.observe(root, { childList: true, subtree: true });
    return () => watcher.disconnect();
  }, [projectId]);
  return frame;
}

export function PlanningScreen({ projectId }: { projectId: string }) {
  const [foldedFor, setFoldedFor] = useState<string | null>(null);
  const frame = useOpenOnCurrentSprint(foldedFor === projectId ? projectId : "");
  useEffect(() => {
    foldHeldBandOnce(localStorage, projectId);
    setFoldedFor(projectId);
  }, [projectId]);
  return (
    <div ref={frame} className="h-full">
      {foldedFor === projectId && <ComponentScreen projectId={projectId} module={planning} />}
    </div>
  );
}
