import { KiboError } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { fr } from "./i18n/fr";
import type { PhoneRuntime } from "./runtime";
import { Login } from "./screens/Login";
import { NeedsPairing } from "./screens/NeedsPairing";
import { Pair } from "./screens/Pair";
import { Shell } from "./screens/Shell";
import { useHashRoute } from "./use-route";

type Phase = "loading" | "login" | "pair" | "needsPairing" | "ready";

const hasCode = (e: unknown, code: string) => e instanceof KiboError && e.code === code;

async function signedIn(runtime: PhoneRuntime): Promise<boolean> {
  try {
    return await runtime.api.session();
  } catch (e) {
    if (hasCode(e, "REMOTE_UNAVAILABLE")) return true;
    throw e;
  }
}

async function enter(runtime: PhoneRuntime): Promise<Phase> {
  const stored = await runtime.keyStore.load();
  runtime.keyring.current = stored?.keys ?? null;
  if (!stored) return "pair";
  if (!(await signedIn(runtime))) return "login";
  try {
    await runtime.client.sync();
  } catch (e) {
    if (hasCode(e, "UNAUTHORIZED")) return "login";
    if (!hasCode(e, "REMOTE_UNAVAILABLE")) console.error("[kibo-phone] sync failed", e);
  }
  try {
    await runtime.client.index();
  } catch (e) {
    if (hasCode(e, "REMOTE_REJECTED")) return "needsPairing";
    throw e;
  }
  return "ready";
}

async function boot(runtime: PhoneRuntime): Promise<Phase> {
  await runtime.snapshots.load();
  return enter(runtime);
}

export function App({ runtime }: { runtime: PhoneRuntime }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [route, navigate] = useHashRoute();

  const follow = useCallback((work: Promise<Phase>) => {
    work.then(setPhase, (e: unknown) => {
      console.error("[kibo-phone] start failed", e);
      setPhase("login");
    });
  }, []);

  useEffect(() => runtime.client.onNeedsPairing(() => setPhase("needsPairing")), [runtime]);
  useEffect(() => runtime.onRevoked(() => setPhase("needsPairing")), [runtime]);
  useEffect(() => runtime.onSessionExpired(() => setPhase("login")), [runtime]);
  useEffect(() => follow(boot(runtime)), [runtime, follow]);

  useEffect(() => {
    if (phase !== "ready") return;
    runtime.presence.start();
    return () => runtime.presence.stop();
  }, [phase, runtime]);

  useEffect(() => {
    if (phase === "pair" || phase === "login") navigate({ name: phase }, { replace: true });
    if (phase === "ready" && (route.name === "pair" || route.name === "login"))
      navigate({ name: "home" }, { replace: true });
  }, [phase, route.name, navigate]);

  const repair = useCallback(async () => {
    runtime.presence.stop();
    runtime.keyring.current = null;
    await runtime.keyStore.clear();
    await runtime.snapshots.clear();
    setPhase("pair");
  }, [runtime]);

  switch (phase) {
    case "loading":
      return <p className="p-6 text-(--tracking-mfg)">{fr.loading}</p>;
    case "pair":
      return <Pair deps={runtime} onPaired={() => follow(enter(runtime))} />;
    case "login":
      return (
        <Login deps={runtime} onSignedIn={() => follow(enter(runtime))} onRepair={() => void repair()} />
      );
    case "needsPairing":
      return <NeedsPairing onRepair={() => void repair()} />;
    case "ready":
      return <Shell client={runtime.client} route={route} navigate={navigate} />;
  }
}
