import { Button } from "@kibo/sdk/ui/button";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { HardDrive, ListTodo } from "lucide-react";
import { fr } from "../../i18n/fr";
import { ChoiceCard } from "../ChoiceCard";

export type SourceKind = "local" | "synced";
type Props = {
  value: SourceKind;
  onValueChange(v: SourceKind): void;
  connected: boolean;
  onOpenSettings(): void;
};
const t = fr.integrations.source;

export function SourcePicker({ value, onValueChange, connected, onOpenSettings }: Props) {
  return (
    <section className="grid gap-2">
      <p className="font-medium">{t.title}</p>
      <RadioGroup
        value={value}
        onValueChange={(v) => onValueChange(v === "synced" ? "synced" : "local")}
        className="grid gap-2 sm:grid-cols-2"
      >
        <ChoiceCard value="local" icon={HardDrive} title={t.local} description={t.localHelp} />
        <ChoiceCard
          value="synced"
          icon={ListTodo}
          title={t.synced}
          description={t.syncedHelp}
          disabled={!connected}
        />
      </RadioGroup>
      {!connected && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {t.notConnected}
          <Button variant="link" className="h-auto p-0 underline" onClick={onOpenSettings}>
            {t.openSettings}
          </Button>
        </p>
      )}
    </section>
  );
}
