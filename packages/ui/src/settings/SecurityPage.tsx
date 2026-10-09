import { frSecurity } from "../i18n/fr-security";
import { IsolationCard } from "./IsolationCard";
import { RemoteAccessCard } from "./RemoteAccessCard";
import { SessionsCard } from "./SessionsCard";
import { SettingsLayout } from "./SettingsLayout";
import { WebAccessCard } from "./WebAccessCard";

export function SecurityPage() {
  return (
    <SettingsLayout active="security">
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{frSecurity.title}</h1>
          <p className="text-sm text-muted-foreground">{frSecurity.subtitle}</p>
        </div>
        <RemoteAccessCard />
        <WebAccessCard />
        <SessionsCard />
        <IsolationCard />
      </div>
    </SettingsLayout>
  );
}
