import { KiboError, type Session } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client, onUnauthorized } from "./api";
import { PairingScreen } from "./shell/lazy-screens";
import { Shell } from "./shell/Shell";

async function bootstrap(): Promise<Session | null> {
  const m = /^#pair=([0-9A-Za-z-]+)$/.exec(location.hash);
  if (m?.[1]) {
    history.replaceState(null, "", location.pathname);
    try {
      await client.pair(m[1]);
    } catch (e) {
      if (!(e instanceof KiboError)) throw e;
    }
  }
  try {
    return await client.rpc({ method: "getSession" });
  } catch (e) {
    if (e instanceof KiboError && e.code === "UNAUTHORIZED") return null;
    throw e;
  }
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    void bootstrap().then(setSession);
    return onUnauthorized(() => setSession(null));
  }, []);
  if (session === undefined) return null;
  if (session === null) return <PairingScreen onPaired={() => void bootstrap().then(setSession)} />;
  return <Shell viewer={session.user} notifications={session.notifications} />;
}
