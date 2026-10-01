import { fr } from "../i18n/fr";
import { UpdateCard } from "../updates/UpdateCard";
import { CliInstallCard } from "./CliInstallCard";
import { SettingsLayout } from "./SettingsLayout";

export function GeneralPage() {
  return (
    <SettingsLayout active="general">
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{fr.settings.general}</h1>
          <p className="text-sm text-muted-foreground">{fr.settings.generalSubtitle}</p>
        </div>
        <UpdateCard />
        <CliInstallCard />
      </div>
    </SettingsLayout>
  );
}
