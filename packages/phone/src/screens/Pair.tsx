import { KiboError } from "@kibo/schema";
import { ShieldCheck } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import { fr } from "../i18n/fr";
import { isCancelled, type PairingDeps, pairPhone } from "../pairing";
import { PhoneScreen, PRIMARY_BUTTON } from "./PhoneScreen";
import { canScan, Scanner } from "./Scanner";

const INVALID_CODES = new Set(["REMOTE_PAIRING_INVALID", "REMOTE_REJECTED", "INVALID_INPUT"]);

function pairError(e: unknown): string {
  if (isCancelled(e)) return fr.pair.cancelled;
  if (!(e instanceof KiboError)) return fr.pair.failed;
  if (INVALID_CODES.has(e.code)) return fr.pair.invalid;
  if (e.code === "RATE_LIMITED") return fr.pair.rateLimited;
  if (e.code === "REMOTE_NOT_FOUND") return fr.pair.noSnapshot;
  return e.code === "REMOTE_UNAVAILABLE" ? fr.pair.offline : fr.pair.failed;
}

const keepStorage = () =>
  navigator.storage
    ?.persist?.()
    .catch((e: unknown) => console.error("[kibo-phone] storage.persist failed", e));

export function Pair({ deps, onPaired }: { deps: PairingDeps; onPaired(): void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pair = useCallback(
    async (text: string) => {
      setBusy(true);
      setError(null);
      try {
        await pairPhone(deps, text);
        await keepStorage();
        onPaired();
      } catch (e) {
        console.error("[kibo-phone] pairing failed", e);
        setError(pairError(e));
        setBusy(false);
      }
    },
    [deps, onPaired],
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void pair(code);
  };
  const scanned = useCallback((text: string) => void pair(text), [pair]);
  return (
    <PhoneScreen
      title={fr.pair.title}
      intro={
        <p>
          {fr.pair.where} {fr.pair.scan}
        </p>
      }
    >
      {canScan() ? (
        <>
          <Scanner onCode={scanned} />
          <div className="flex items-center gap-3 text-[13px] text-(--tracking-dim)">
            <span aria-hidden className="h-px flex-1 bg-(--tracking-border)" />
            {fr.pair.or}
            <span aria-hidden className="h-px flex-1 bg-(--tracking-border)" />
          </div>
        </>
      ) : null}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-[14px] font-medium">
          {fr.pair.paste}
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={fr.pair.placeholder}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 rounded-lg border border-(--tracking-border) bg-transparent px-3 font-mono text-[15px] outline-none focus:border-(--tracking-mfg)"
          />
        </label>
        <button type="submit" disabled={busy || code.trim() === ""} className={PRIMARY_BUTTON}>
          {busy ? fr.pair.pairing : fr.pair.submit}
        </button>
        {error ? (
          <p role="alert" className="text-[14px] text-(--tracking-red)">
            {error}
          </p>
        ) : null}
      </form>
      <p className="flex items-start gap-2 text-[13px] text-(--tracking-mfg)">
        <ShieldCheck aria-hidden size={16} className="mt-0.5 shrink-0" />
        {fr.pair.keyNote}
      </p>
    </PhoneScreen>
  );
}
