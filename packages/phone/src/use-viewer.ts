import { useEffect, useState } from "react";
import type { RemoteClient } from "./remote-client";

export function useViewer(client: RemoteClient): string | null {
  const [viewer, setViewer] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    client.rpc({ method: "getSession" }).then(
      (session) => alive && setViewer(session.user),
      (e: unknown) => console.error("[kibo-phone] session read failed", e),
    );
    return () => {
      alive = false;
    };
  }, [client]);
  return viewer;
}
