import { fr } from "../../i18n/fr";
import { useDaemonOnline } from "../../state/use-agents";

export function OfflineChip() {
  const online = useDaemonOnline();
  if (online) return null;
  return (
    <output className="k-offline" aria-label={fr.nav.offline}>
      <span>{fr.nav.offline}</span>
    </output>
  );
}
