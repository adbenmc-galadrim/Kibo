import { fr } from "../i18n/fr";
import { UpdateCard } from "../updates/UpdateCard";
import { CliInstallCard } from "./CliInstallCard";
import { SettingsNav } from "./SettingsNav";

export function GeneralPage() {
  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="general" />
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{fr.settings.general}</h1>
          <p className="text-sm text-muted-foreground">{fr.settings.generalSubtitle}</p>
        </div>
        <UpdateCard />
        <CliInstallCard />
      </div>
    </div>
  );
}
