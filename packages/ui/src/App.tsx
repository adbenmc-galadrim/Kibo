import { KiboError, type Session } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client, onUnauthorized } from "./api";
import { DaemonUnreachable, PairingScreen, preloadDaemonUnreachable } from "./shell/lazy-screens";
import { Shell } from "./shell/Shell";
import { LoadingScreen } from "./shell/Startup";
import { inTauri } from "./shell/workspace-actions";

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

type Boot =
  | { kind: "loading" }
  | { kind: "unreachable"; error: unknown; attempt: number; retryAt: number }
  | { kind: "pairing" }
  | { kind: "ready"; session: Session };

type Props = { now?: () => number; retryMs?: number };

const COUNTDOWN_TICK_MS = 250;

export function App({ now = Date.now, retryMs = 3000 }: Props) {
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
  const [, setTick] = useState(0);
  const start = useCallback(
    (attempt: number) =>
      bootstrap().then(
        (session) => setBoot(session ? { kind: "ready", session } : { kind: "pairing" }),
        (error: unknown) => setBoot({ kind: "unreachable", error, attempt, retryAt: now() + retryMs }),
      ),
    [now, retryMs],
  );
  useEffect(() => {
    preloadDaemonUnreachable().catch((e: unknown) =>
      console.error("[kibo] startup screen failed to load", e),
    );
    void start(0);
    return onUnauthorized(() => setBoot({ kind: "pairing" }));
  }, [start]);
  const attempt = boot.kind === "unreachable" ? boot.attempt : null;
  useEffect(() => {
    if (attempt === null) return;
    const retry = setTimeout(() => void start(attempt + 1), retryMs);
    const tick = setInterval(() => setTick((n) => n + 1), COUNTDOWN_TICK_MS);
    return () => {
      clearTimeout(retry);
      clearInterval(tick);
    };
  }, [attempt, retryMs, start]);

  if (boot.kind === "loading") return <LoadingScreen />;
  if (boot.kind === "pairing") return <PairingScreen onPaired={() => void start(0)} />;
  if (boot.kind === "unreachable")
    return (
      <DaemonUnreachable
        error={boot.error}
        inApp={inTauri()}
        nextRetryInMs={Math.max(0, boot.retryAt - now())}
        onRetry={() => void start(boot.attempt + 1)}
      />
    );
  return <Shell viewer={boot.session.user} notifications={boot.session.notifications} />;
}
