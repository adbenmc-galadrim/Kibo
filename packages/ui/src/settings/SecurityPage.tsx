import { fr } from "../i18n/fr";
import { IsolationCard } from "./IsolationCard";
import { RemoteAccessCard } from "./RemoteAccessCard";
import { SessionsCard } from "./SessionsCard";
import { SettingsNav } from "./SettingsNav";
import { WebAccessCard } from "./WebAccessCard";

export function SecurityPage() {
  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="security" />
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{fr.security.title}</h1>
          <p className="text-sm text-muted-foreground">{fr.security.subtitle}</p>
        </div>
        <RemoteAccessCard />
        <WebAccessCard />
        <SessionsCard />
        <IsolationCard />
      </div>
    </div>
  );
}
