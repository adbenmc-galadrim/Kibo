import { KiboError } from "@kibo/schema";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { isCancelled, type PairingDeps, signIn } from "../pairing";
import { PhoneScreen, PRIMARY_BUTTON } from "./PhoneScreen";

function loginError(e: unknown): string {
  if (isCancelled(e)) return fr.login.cancelled;
  if (!(e instanceof KiboError)) return fr.login.failed;
  if (e.code === "RATE_LIMITED") return fr.login.rateLimited;
  if (e.code === "REMOTE_UNAVAILABLE") return fr.login.offline;
  return e.code === "UNAUTHORIZED" ? fr.login.refused : fr.login.failed;
}

type LoginProps = { deps: Pick<PairingDeps, "api" | "passkeys">; onSignedIn(): void; onRepair(): void };

export function Login({ deps, onSignedIn, onRepair }: LoginProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(deps);
      onSignedIn();
    } catch (e) {
      console.error("[kibo-phone] sign-in failed", e);
      setError(loginError(e));
      setBusy(false);
    }
  };
  return (
    <PhoneScreen title={fr.login.title} intro={<p>{fr.login.body}</p>}>
      <button type="button" disabled={busy} onClick={() => void submit()} className={PRIMARY_BUTTON}>
        {busy ? fr.login.pending : fr.login.submit}
      </button>
      {error ? (
        <p role="alert" className="text-[14px] text-(--tracking-red)">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onRepair}
        className="min-h-11 text-[15px] text-(--tracking-mfg) underline"
      >
        {fr.login.repair}
      </button>
    </PhoneScreen>
  );
}
