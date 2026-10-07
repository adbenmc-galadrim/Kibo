import type { KiboSdk } from "@kibo/sdk";
import { type LightingSettings, lightingSettings } from "@kibo/sdk/three";
import { useCallback, useEffect, useRef, useState } from "react";
import { toConfigPatch } from "./lighting-config";

export const SAVE_DELAY_MS = 300;

export type LightingDraft = {
  draft: LightingSettings;
  update(patch: Partial<LightingSettings>): void;
  failed: boolean;
};

export function useLightingDraft(sdk: KiboSdk, delay = SAVE_DELAY_MS): LightingDraft {
  const fromConfig = lightingSettings(sdk.config);
  const { preset, intensity, shadows, environment } = fromConfig;
  const [draft, setDraft] = useState(fromConfig);
  const [failed, setFailed] = useState(false);
  const latest = useRef({ sdk, draft });
  latest.current = { sdk, draft };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(() => {
    timer.current = null;
    const { sdk: current, draft: value } = latest.current;
    current.setConfig(toConfigPatch(value)).then(
      () => setFailed(false),
      (e: unknown) => {
        console.error("[viewer-3d] lighting not saved", e);
        setFailed(true);
      },
    );
  }, []);

  const update = useCallback(
    (patch: Partial<LightingSettings>) => {
      setDraft((d) => ({ ...d, ...patch }));
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(save, delay);
    },
    [delay, save],
  );

  useEffect(() => {
    if (timer.current === null) setDraft({ preset, intensity, shadows, environment });
  }, [preset, intensity, shadows, environment]);

  useEffect(
    () => () => {
      if (timer.current === null) return;
      clearTimeout(timer.current);
      save();
    },
    [save],
  );

  return { draft, update, failed };
}
