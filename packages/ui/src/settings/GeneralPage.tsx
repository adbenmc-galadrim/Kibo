import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Select, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Switch } from "@kibo/sdk/ui/switch";
import { FolderOpen } from "lucide-react";
import { type ReactNode, useId } from "react";
import { fr } from "../i18n/fr";
import { CliInstallCard } from "./CliInstallCard";
import { SettingsNav } from "./SettingsNav";

function Setting({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children(id: string): ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="grid gap-0.5">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        {help && <p className="text-2xs text-muted-foreground">{help}</p>}
      </div>
      {children(id)}
    </div>
  );
}

function ApplicationCard() {
  const s = fr.settings;
  return (
    <Card className="gap-4" title={s.soon}>
      <CardHeader>
        <CardTitle>{s.application}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Setting label={s.language}>
          {(id) => (
            <Select value="fr" disabled>
              <SelectTrigger id={id} size="sm">
                <SelectValue>{s.french}</SelectValue>
              </SelectTrigger>
            </Select>
          )}
        </Setting>
        <Setting label={s.openAtLogin} help={s.openAtLoginHelp}>
          {(id) => <Switch id={id} disabled />}
        </Setting>
        <Setting label={s.dataDir} help={s.dataDirHelp}>
          {() => (
            <Button variant="outline" size="sm" disabled>
              <FolderOpen aria-hidden />
              {s.open}
            </Button>
          )}
        </Setting>
      </CardContent>
    </Card>
  );
}

export function GeneralPage() {
  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="general" />
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{fr.settings.general}</h1>
          <p className="text-sm text-muted-foreground">{fr.settings.generalSubtitle}</p>
        </div>
        <ApplicationCard />
        <CliInstallCard />
      </div>
    </div>
  );
}
