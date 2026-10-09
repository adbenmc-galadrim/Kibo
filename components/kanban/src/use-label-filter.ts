import type { KiboSdk } from "@kibo/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { LABEL_ALL, LABEL_FILTER_KEY, labelFilterOf } from "./filter";

export function useLabelFilter(sdk: KiboSdk, writable: boolean) {
  const [label, setLabel] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const chosen = useRef(false);

  useEffect(() => {
    let live = true;
    sdk.data.get(LABEL_FILTER_KEY).then(
      (value) => {
        if (live && !chosen.current) setLabel(labelFilterOf(value));
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [sdk]);

  const choose = useCallback(
    (next: string | null) => {
      chosen.current = true;
      setLabel(next);
      if (!writable) return;
      sdk.data.set(LABEL_FILTER_KEY, next ?? LABEL_ALL).then(
        () => setFailed(false),
        () => setFailed(true),
      );
    },
    [sdk, writable],
  );

  return { label, choose, failed };
}
