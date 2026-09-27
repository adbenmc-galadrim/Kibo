import { KiboError, type RuntimeInfo } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export type RuntimeInfoState = { info: RuntimeInfo | null; error: boolean };

type RuntimeSource = Pick<typeof client, "rpc">;

const remembered = new WeakMap<RuntimeSource, Promise<RuntimeInfo>>();

function runtimeInfoOf(source: RuntimeSource): Promise<RuntimeInfo> {
  const known = remembered.get(source);
  if (known) return known;
  const pending = source.rpc({ method: "getRuntimeInfo" });
  remembered.set(source, pending);
  pending.catch(() => remembered.delete(source));
  return pending;
}

export function useRuntimeInfo(): RuntimeInfoState {
  const [state, setState] = useState<RuntimeInfoState>({ info: null, error: false });
  useEffect(() => {
    let live = true;
    runtimeInfoOf(client).then(
      (info) => {
        if (live) setState({ info, error: false });
      },
      (e: unknown) => {
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
