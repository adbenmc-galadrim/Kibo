import { KiboError } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client, onUnauthorized } from "./api";
import { PairingScreen } from "./shell/PairingScreen";
import { Shell } from "./shell/Shell";

async function bootstrap(): Promise<string | null> {
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
    return (await client.rpc({ method: "getSession" })).user;
  } catch (e) {
    if (e instanceof KiboError && e.code === "UNAUTHORIZED") return null;
    throw e;
  }
}

export function App() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void bootstrap().then(setUser);
    return onUnauthorized(() => setUser(null));
  }, []);
  if (user === undefined) return null;
  if (user === null) return <PairingScreen onPaired={() => void bootstrap().then(setUser)} />;
  return <Shell viewer={user} />;
}
