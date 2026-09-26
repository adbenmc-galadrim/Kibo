import { KiboError, type RuntimeInfo } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export type RuntimeInfoState = { info: RuntimeInfo | null; error: boolean };

let cached: Promise<RuntimeInfo> | null = null;

export function useRuntimeInfo(): RuntimeInfoState {
  const [state, setState] = useState<RuntimeInfoState>({ info: null, error: false });
  useEffect(() => {
    cached ??= client.rpc({ method: "getRuntimeInfo" });
    let live = true;
    cached.then(
      (info) => {
        if (live) setState({ info, error: false });
      },
      (e: unknown) => {
        cached = null;
        if (e instanceof KiboError && e.code === "UNAUTHORIZED") return;
        console.error("[kibo-ui] runtime info unavailable", e);
        if (live) setState({ info: null, error: true });
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}
