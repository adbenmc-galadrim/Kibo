import { KeyRound } from "lucide-react";
import { fr } from "../i18n/fr";
import { PhoneScreen, PRIMARY_BUTTON } from "./PhoneScreen";

export function NeedsPairing({ onRepair }: { onRepair(): void }) {
  return (
    <PhoneScreen title={fr.needsPairing.title}>
      <div className="flex items-start gap-3 text-[15px] text-(--tracking-mfg)">
        <KeyRound aria-hidden size={18} className="mt-0.5 shrink-0 text-(--tracking-amber)" />
        <p>{fr.needsPairing.body}</p>
      </div>
      <button type="button" onClick={onRepair} className={PRIMARY_BUTTON}>
        {fr.needsPairing.action}
      </button>
    </PhoneScreen>
  );
}
