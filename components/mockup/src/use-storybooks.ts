import type { StorybookOrigin } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

const NONE: StorybookOrigin[] = [];

export function useStorybooks(enabled: boolean): { origins: StorybookOrigin[]; reload(): void } {
  const sdk = useSdk();
  const [origins, setOrigins] = useState<StorybookOrigin[]>(NONE);
  const generation = useRef(0);

  const load = useCallback(() => {
    const ticket = ++generation.current;
    sdk.design.storybooks().then(
      (list) => {
        if (generation.current === ticket) setOrigins(list);
      },
      (e: unknown) => {
        console.error("[mockup] storybook origins not loaded", e);
        if (generation.current === ticket) setOrigins(NONE);
      },
    );
  }, [sdk]);

  useEffect(() => {
    if (enabled) load();
    return () => {
      generation.current++;
    };
  }, [enabled, load]);

  return { origins: enabled ? origins : NONE, reload: () => enabled && load() };
}
