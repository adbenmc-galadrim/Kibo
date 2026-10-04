import { useEffect, useState } from "react";
import { client } from "../api";
import { type AiBlock, useAiAvailability } from "./use-ai-availability";

export function useDemoProject(projectId: string | null): boolean {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setDemo(false);
    if (!projectId) return;
    let alive = true;
    client.rpc({ method: "listProjects" }).then(
      (list) => alive && setDemo(list.some((p) => p.id === projectId && p.demo === true)),
      (e: unknown) => console.error("listProjects failed", e),
    );
    return () => {
      alive = false;
    };
  }, [projectId]);
  return demo;
}

export function useGeneratorAvailability(projectId: string | null): {
  ready: boolean;
  block: AiBlock;
  demo: boolean;
} {
  const { ready, block } = useAiAvailability("generateur");
  const demo = useDemoProject(projectId);
  return demo ? { ready: true, block: null, demo } : { ready, block, demo };
}
