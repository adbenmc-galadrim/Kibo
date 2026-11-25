import { useEffect, useState } from "react";
import type { RemoteClient } from "./remote-client";

type ViewerState = { viewer: string | null; failed: boolean };

export function useViewer(client: RemoteClient): ViewerState {
  const [state, setState] = useState<ViewerState>({ viewer: null, failed: false });
  useEffect(() => {
    let alive = true;
    client.rpc({ method: "getSession" }).then(
      (session) => alive && setState({ viewer: session.user, failed: false }),
      (e: unknown) => {
        console.error("[kibo-phone] session read failed", e);
        if (alive) setState({ viewer: null, failed: true });
      },
    );
    return () => {
      alive = false;
    };
  }, [client]);
  return state;
}
