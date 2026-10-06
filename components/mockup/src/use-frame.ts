import { type DesignFrame, type DesignFrameKey, type FrameProblem, frameProblemOf } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { useEffect, useState } from "react";

export type FrameView =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; frame: DesignFrame; refreshing: boolean }
  | { status: "failed"; problem: FrameProblem };

const INVALID: FrameView = { status: "failed", problem: { kind: "unavailable", code: "INVALID_INPUT" } };

export function useFrame(
  url: string | null,
  key: DesignFrameKey | null,
): { view: FrameView; refresh(): void } {
  const sdk = useSdk();
  const [view, setView] = useState<FrameView>({ status: url ? "loading" : "empty" });
  const [refreshCount, setRefreshCount] = useState(0);
  useEffect(() => {
    if (!url || !key) {
      setView(url ? INVALID : { status: "empty" });
      return;
    }
    setView((v) => (v.status === "ready" ? { ...v, refreshing: true } : { status: "loading" }));
    let alive = true;
    sdk.design.frame(url, { refresh: refreshCount > 0 }).then(
      (frame) => {
        if (alive) setView({ status: "ready", frame, refreshing: false });
      },
      (e: unknown) => {
        if (!alive) return;
        const problem = frameProblemOf(e, key.provider);
        if (problem.kind === "unavailable") console.error("[mockup] frame not loaded", e);
        setView({ status: "failed", problem });
      },
    );
    return () => {
      alive = false;
    };
  }, [sdk, url, key, refreshCount]);
  return { view, refresh: () => setRefreshCount((n) => n + 1) };
}
