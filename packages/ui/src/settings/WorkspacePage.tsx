import { type IconInput, iconUrl, type WorkspaceConfig, type WorkspacePatch } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { type FormEvent, useEffect, useId, useState } from "react";
import { client } from "../api";
import { IconField } from "../dialogs/IconField";
import { fr } from "../i18n/fr";
import { frWorkspace as t } from "../i18n/fr-workspace";
import { errorMessage } from "../lib/error-message";
import { useFlash } from "../lib/use-flash";
import { SettingsLayout } from "./SettingsLayout";

type Props = { config: WorkspaceConfig | null };

const currentName = (config: WorkspaceConfig): string => config.workspaceName ?? fr.workspace.defaultName;

export function workspacePatch(
  config: WorkspaceConfig,
  name: string,
  description: string,
): WorkspacePatch | null {
  const patch: WorkspacePatch = {};
  const trimmedName = name.trim();
  if (trimmedName !== currentName(config)) patch.name = trimmedName;
  const trimmedDescription = description.trim();
  if (trimmedDescription !== (config.workspaceDescription ?? ""))
    patch.description = trimmedDescription === "" ? null : trimmedDescription;
  return Object.keys(patch).length === 0 ? null : patch;
}

export function WorkspacePage({ config }: Props) {
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(config ? currentName(config) : "");
  const [description, setDescription] = useState(config?.workspaceDescription ?? "");
  const [pending, setPending] = useState<IconInput | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flash = useFlash();
  useEffect(() => {
    if (!config) return;
    setName(currentName(config));
    setDescription(config.workspaceDescription ?? "");
    setPending(null);
    setRemoved(false);
  }, [config]);

  const patch = config ? workspacePatch(config, name, description) : null;
  const iconChanged = pending !== null || (removed && config?.workspaceIcon !== null);
  const dirty = config !== null && name.trim().length > 0 && (patch !== null || iconChanged);
  const currentUrl = config?.workspaceIcon ? iconUrl({ kind: "workspace" }, config.workspaceIcon) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!config || !dirty) return;
    setBusy(true);
    setError(null);
    try {
      if (patch) await client.rpc({ method: "config", command: { method: "updateWorkspace", patch } });
      if (iconChanged) await client.rpc({ method: "setIcon", owner: { kind: "workspace" }, icon: pending });
      flash.flash(t.saved);
    } catch (err) {
      setError(`${t.failed} ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsLayout active="workspace">
      <form onSubmit={submit} className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>{t.identity}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <IconField
              label={t.image}
              currentUrl={currentUrl}
              pending={pending}
              removed={removed}
              onPick={(icon) => {
                setPending(icon);
                setRemoved(false);
              }}
              onRemove={() => {
                setPending(null);
                setRemoved(true);
              }}
            />
            <div className="grid gap-1.5">
              <Label htmlFor={nameId}>{t.name}</Label>
              <Input
                id={nameId}
                value={name}
                maxLength={40}
                disabled={!config}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-2xs text-muted-foreground">{t.nameHelp}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={descriptionId}>{t.description}</Label>
              <Textarea
                id={descriptionId}
                value={description}
                maxLength={500}
                rows={3}
                disabled={!config}
                placeholder={t.descriptionPlaceholder}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-2xs text-muted-foreground">{t.descriptionHelp}</p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={!dirty || busy}>
                {t.save}
              </Button>
              {flash.message && <span className="text-xs text-muted-foreground">{flash.message}</span>}
            </div>
          </CardContent>
        </Card>
      </form>
    </SettingsLayout>
  );
}
