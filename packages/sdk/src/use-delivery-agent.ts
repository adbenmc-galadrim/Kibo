import type { DeliveryAgent } from "@kibo/schema";
import { useEffect, useState } from "react";
import { useSdk } from "./react";
import type { KiboSdk } from "./types";

const answers = new WeakMap<KiboSdk, Promise<DeliveryAgent | null>>();

function deliveryAgentOf(sdk: KiboSdk): Promise<DeliveryAgent | null> {
  const known = answers.get(sdk);
  if (known) return known;
  const answer = sdk.runs.deliveryAgent().catch((e: unknown): null => {
    console.warn(`[kibo-sdk] ${sdk.instanceId}: delivery agent unknown`, e);
    return null;
  });
  answers.set(sdk, answer);
  return answer;
}

export function useDeliveryAgentKnown(): boolean {
  const sdk = useSdk();
  const [known, setKnown] = useState(false);
  useEffect(() => {
    let alive = true;
    void deliveryAgentOf(sdk).then((agent) => alive && setKnown(agent !== null));
    return () => {
      alive = false;
    };
  }, [sdk]);
  return known;
}
