import type { AgentSettings, AgentSettingsPatch, PermissionMode, WorkspaceStrategy } from "@kibo/schema";
import { Alert, AlertDescription } from "@kibo/sdk/ui/alert";
import { Badge } from "@kibo/sdk/ui/badge";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Switch } from "@kibo/sdk/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { Check, Lock } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { fr } from "../../i18n/fr";
import { frAgentsPage } from "../../i18n/fr-agents-page";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { frDeliverySettings } from "../../i18n/fr-delivery-settings";
import type { UserHome } from "../../lib/use-home";
import { AllowRulesField } from "../AllowRulesField";
import { AddDirsField } from "./AddDirsField";
import { FoldSection } from "./FoldSection";

type Props = {
  settings: AgentSettings;
  extra: string;
  system: boolean;
  parallelMax: number;
  hostSlots: number;
  failed: boolean;
  home: UserHome;
  preset?: ReactNode;
  presetAt: string | null;
  revision: number;
  onPatch(patch: AgentSettingsPatch): void;
};

const t = frAgentsSkills.settings;
const ALLOW_DELAY_MS = 600;
const WORKSPACES: readonly WorkspaceStrategy[] = ["worktree", "isolated", "repo"];
const MODES: readonly PermissionMode[] = ["plan", "acceptEdits", "default", "auto"];
const isWorkspace = (v: string): v is WorkspaceStrategy => WORKSPACES.some((w) => w === v);
const isMode = (v: string): v is PermissionMode => MODES.some((m) => m === v);

export function settingsSummary(s: AgentSettings): string {
  return [
    fr.strategies[s.workspace],
    frAgentsPage.permissionModes[s.permissionMode],
    t.runs(s.maxParallel),
    s.enabled ? t.on : t.off,
  ].join(" · ");
}

export function TechnicalSettings({
  settings,
  extra,
  system,
  parallelMax,
  hostSlots,
  failed,
  home,
  preset,
  presetAt,
  revision,
  onPatch,
}: Props) {
  const id = useId();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);
  const later = (key: string, patch: AgentSettingsPatch) => {
    const previous = timers.current.get(key);
    if (previous) clearTimeout(previous);
    timers.current.set(
      key,
      setTimeout(() => onPatch(patch), ALLOW_DELAY_MS),
    );
  };
  return (
    <FoldSection title={t.title} summary={settingsSummary(settings)} action={preset}>
      <p className="text-xs text-muted-foreground">{system ? frAgentsSkills.sheet.systemReason : t.help}</p>
      {presetAt !== null && (
        <Alert>
          <Check aria-hidden />
          <AlertDescription>{frDeliverySettings.preset.applied(presetAt)}</AlertDescription>
        </Alert>
      )}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t.failed}
        </p>
      )}
      <div className="grid gap-2">
        <Label>{t.workspace}</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label={t.workspace}
          className="w-fit"
          value={settings.workspace}
          disabled={system}
          onValueChange={(v) => isWorkspace(v) && onPatch({ workspace: v })}
        >
          {WORKSPACES.map((w) => (
            <ToggleGroupItem key={w} value={w} className="px-3 text-xs">
              {fr.strategies[w]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid gap-2">
        <Label>{t.permissions}</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label={t.permissions}
          className="w-fit flex-wrap"
          value={settings.permissionMode}
          disabled={system}
          onValueChange={(v) => isMode(v) && onPatch({ permissionMode: v })}
        >
          {MODES.map((m) => (
            <ToggleGroupItem key={m} value={m} className="px-3 text-xs">
              {frAgentsPage.permissionModes[m]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">{t.neverBypass}</p>
      </div>
      <AllowRulesField
        key={`allow-${revision}`}
        value={settings.allow}
        disabled={system}
        onProblem={() => {}}
        onChange={(allow) => later("allow", { allow })}
      />
      <AddDirsField
        key={`dirs-${revision}-${home ?? ""}`}
        value={settings.addDirs}
        home={home}
        disabled={system}
        onChange={(addDirs) => later("addDirs", { addDirs })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <Label htmlFor={`${id}-parallel`}>{t.parallel}</Label>
          <Input
            id={`${id}-parallel`}
            type="number"
            min={1}
            max={parallelMax}
            disabled={parallelMax <= 1 && system}
            defaultValue={settings.maxParallel}
            className="w-32"
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= parallelMax) onPatch({ maxParallel: n });
            }}
          />
          <p className="text-xs text-muted-foreground">{t.parallelHelp(hostSlots)}</p>
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor={`${id}-enabled`}>{t.enabled}</Label>
          <span className="flex items-center gap-2 text-sm">
            <Switch
              id={`${id}-enabled`}
              checked={settings.enabled}
              onCheckedChange={(enabled) => onPatch({ enabled })}
            />
            {t.enabledHelp}
          </span>
        </div>
      </div>
      {extra.trim() !== "" && (
        <div className="grid gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Lock aria-hidden className="size-3.5" />
            {t.extra}
            <Badge variant="outline" className="text-[10px] font-normal">
              {t.readOnly}
            </Badge>
          </p>
          <pre className="overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
            {extra.trimEnd()}
          </pre>
          <p className="text-xs text-muted-foreground">{t.extraHelp}</p>
        </div>
      )}
    </FoldSection>
  );
}
