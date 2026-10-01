import { AgentModel, type AgentProfile, type ProfileInput } from "@kibo/schema";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Switch } from "@kibo/sdk/ui/switch";
import { useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";

type Props = { profile: AgentProfile; onSaved: () => void };
type Patch = Partial<Pick<ProfileInput, "model" | "enabled" | "maxParallel">>;

const PARALLEL = ["1", "2", "3", "4"];

export function SystemProfileFields({ profile, onSaved }: Props) {
  const id = useId();
  const [model, setModel] = useState<AgentModel>(profile.model);
  const [enabled, setEnabled] = useState(profile.enabled);
  const [parallel, setParallel] = useState(String(profile.maxParallel));
  const [error, setError] = useState<string | null>(null);

  const save = async (patch: Patch, undo: () => void) => {
    setError(null);
    try {
      await client.rpc({
        method: "config",
        command: { method: "updateProfile", profileId: profile.id, patch },
      });
    } catch {
      undo();
      setError(fr.profile.failed);
      return;
    }
    onSaved();
  };

  const pickModel = (v: string) => {
    const parsed = AgentModel.safeParse(v);
    if (!parsed.success) return;
    const previous = model;
    setModel(parsed.data);
    void save({ model: parsed.data }, () => setModel(previous));
  };
  const pickParallel = (v: string) => {
    if (!PARALLEL.includes(v)) return;
    const previous = parallel;
    setParallel(v);
    void save({ maxParallel: Number(v) }, () => setParallel(previous));
  };
  const toggle = (next: boolean) => {
    setEnabled(next);
    void save({ enabled: next }, () => setEnabled(!next));
  };

  return (
    <div className="grid gap-4 px-4">
      <p className="text-xs text-muted-foreground">{fr.profile.systemHelp}</p>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-model`}>{fr.profile.model}</Label>
        <Select value={model} onValueChange={pickModel}>
          <SelectTrigger id={`${id}-model`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AgentModel.options.map((m) => (
              <SelectItem key={m} value={m}>
                {fr.agents.modelNames[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-parallel`}>{fr.profile.parallel}</Label>
        <Select value={parallel} onValueChange={pickParallel}>
          <SelectTrigger id={`${id}-parallel`} className="w-24" aria-describedby={`${id}-parallel-help`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARALLEL.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p id={`${id}-parallel-help`} className="text-xs text-muted-foreground">
          {frAgentsPage.systemParallelHelp}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-enabled`}>{fr.profile.enabled}</Label>
        <Switch id={`${id}-enabled`} checked={enabled} onCheckedChange={toggle} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
