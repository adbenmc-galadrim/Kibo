import { AgentModel, type AgentProfile, type ProfileInput, type WorkspaceConfig } from "@kibo/schema";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Switch } from "@kibo/sdk/ui/switch";
import { useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { isDemoProfile, isProjectAgentProfile } from "./demo-profile";
import { ProfileGuidelines } from "./ProfileGuidelines";

type Props = { profile: AgentProfile; config: WorkspaceConfig; onSaved: () => void };
type Patch = Partial<Pick<ProfileInput, "model" | "enabled" | "maxParallel">>;

const PARALLEL = ["1", "2", "3", "4"];

type ParallelProps = { id: string; value: string; onChange(value: string): void };

function FixedParallel({ value, help }: { value: string; help: string }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{fr.profile.parallel}</span>
      <p className="text-sm">{value}</p>
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
}

function ParallelField({ id, value, onChange }: ParallelProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${id}-parallel`}>{fr.profile.parallel}</Label>
      <Select value={value} onValueChange={onChange}>
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
  );
}

export function SystemProfileFields({ profile, config, onSaved }: Props) {
  const id = useId();
  const demo = isDemoProfile(profile);
  const projectAgent = isProjectAgentProfile(profile);
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
          <SelectTrigger
            id={`${id}-model`}
            className="w-full"
            aria-describedby={demo ? `${id}-model-help` : undefined}
          >
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
        {demo && (
          <p id={`${id}-model-help`} className="text-xs text-muted-foreground">
            {frAgentsPage.demo.modelNoEffect}
          </p>
        )}
      </div>
      {demo ? (
        <div className="grid gap-2">
          <span className="text-sm font-medium">{fr.profile.parallel}</span>
          <p className="text-sm text-muted-foreground">{frAgentsPage.demo.parallel}</p>
        </div>
      ) : projectAgent ? (
        <FixedParallel value="1" help={frProjectAgent.profile.parallel} />
      ) : (
        <ParallelField id={id} value={parallel} onChange={pickParallel} />
      )}
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-enabled`}>{fr.profile.enabled}</Label>
        <Switch id={`${id}-enabled`} checked={enabled} onCheckedChange={toggle} />
      </div>
      {projectAgent && (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">{frProjectAgent.profile.guidelines}</p>
          <ProfileGuidelines
            profile={profile}
            config={config}
            drafts={[]}
            onDraftsChange={() => {}}
            onError={setError}
            onFailure={() => setError(fr.profile.failed)}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
