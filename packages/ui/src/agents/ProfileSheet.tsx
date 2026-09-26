import {
  AgentModel,
  AgentProfile,
  KiboError,
  PermissionMode,
  ProfileInput,
  ProfileName,
  type WorkspaceConfig,
  WorkspaceStrategy,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { type GuidelineDraft, ProfileGuidelines } from "./ProfileGuidelines";

type Props = {
  profile: AgentProfile | null;
  config: WorkspaceConfig;
  hostSlots: number;
  onClose: () => void;
};

const STRATEGIES = ["worktree", "isolated", "repo"] as const;
const MODES = ["plan", "acceptEdits", "default"] as const;

function failure(e: unknown): string {
  return e instanceof KiboError && e.code === "PROFILE_IN_USE" ? fr.profile.inUse : fr.profile.failed;
}

export function ProfileSheet({ profile, config, hostSlots, onClose }: Props) {
  const id = useId();
  const [name, setName] = useState(profile?.name ?? "");
  const [model, setModel] = useState<AgentModel>(profile?.model ?? "opus");
  const [workspace, setWorkspace] = useState<WorkspaceStrategy>(profile?.workspace ?? "worktree");
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(profile?.permissionMode ?? "default");
  const [maxParallel, setMaxParallel] = useState(String(profile?.maxParallel ?? 1));
  const [subagents, setSubagents] = useState<AgentModel[]>(profile?.subagents ?? []);
  const [drafts, setDrafts] = useState<GuidelineDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pickModel = (v: string) => {
    const parsed = AgentModel.safeParse(v);
    if (parsed.success) setModel(parsed.data);
  };
  const pickWorkspace = (v: string) => {
    const parsed = WorkspaceStrategy.safeParse(v);
    if (parsed.success) setWorkspace(parsed.data);
  };
  const pickMode = (v: string) => {
    const parsed = PermissionMode.safeParse(v);
    if (parsed.success) setPermissionMode(parsed.data);
  };
  const pickSubagents = (values: string[]) =>
    setSubagents(
      values.flatMap((v) => {
        const parsed = AgentModel.safeParse(v);
        return parsed.success ? [parsed.data] : [];
      }),
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = ProfileInput.safeParse({
      name: name.trim(),
      model,
      execution: "cli",
      permissionMode,
      workspace,
      maxParallel: Number(maxParallel),
      subagents,
    });
    if (!input.success) {
      setError(ProfileName.safeParse(name.trim()).success ? fr.profile.failed : fr.profile.invalidName);
      return;
    }
    try {
      if (profile) {
        await client.rpc({
          method: "config",
          command: { method: "updateProfile", profileId: profile.id, patch: input.data },
        });
      } else {
        const created = AgentProfile.parse(
          await client.rpc({ method: "config", command: { method: "createProfile", profile: input.data } }),
        );
        for (const g of drafts) {
          await client.rpc({
            method: "config",
            command: {
              method: "addGuideline",
              owner: { scope: "profile", profileId: created.id },
              path: g.path,
              content: g.content,
            },
          });
        }
      }
    } catch (err) {
      setError(failure(err));
      return;
    }
    onClose();
  };

  const remove = async () => {
    if (!profile) return;
    setError(null);
    try {
      await client.rpc({ method: "config", command: { method: "deleteProfile", profileId: profile.id } });
    } catch (e) {
      setError(failure(e));
      return;
    }
    onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[520px] overflow-y-auto sm:max-w-[520px]">
        <form onSubmit={submit} className="flex min-h-full flex-col gap-4">
          <SheetHeader>
            <SheetTitle>{profile ? fr.profile.editTitle(profile.name) : fr.profile.createTitle}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-name`}>{fr.profile.name}</Label>
              <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              <p className="text-xs text-muted-foreground">{fr.profile.nameHelp}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-model`}>{fr.profile.model}</Label>
              <Select value={model} onValueChange={pickModel}>
                <SelectTrigger id={`${id}-model`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AgentModel.options.map((m) => (
                    <SelectItem key={m} value={m}>
                      {fr.models[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-execution`}>{fr.profile.execution}</Label>
              <Select value="cli">
                <SelectTrigger id={`${id}-execution`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cli">{fr.profile.cli}</SelectItem>
                  <SelectItem value="sdk" disabled>
                    {fr.profile.sdk}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <p id={`${id}-workspace`} className="text-sm font-medium">
                {fr.profile.workspace}
              </p>
              <ToggleGroup
                type="single"
                variant="outline"
                aria-labelledby={`${id}-workspace`}
                value={workspace}
                onValueChange={pickWorkspace}
                className="w-full"
              >
                {STRATEGIES.map((s) => (
                  <ToggleGroupItem key={s} value={s} className="flex-1">
                    {fr.strategies[s]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="grid gap-2">
              <p id={`${id}-permissions`} className="text-sm font-medium">
                {fr.profile.permissions}
              </p>
              <ToggleGroup
                type="single"
                variant="outline"
                aria-labelledby={`${id}-permissions`}
                value={permissionMode}
                onValueChange={pickMode}
                className="w-full"
              >
                {MODES.map((m) => (
                  <ToggleGroupItem key={m} value={m} className="flex-1">
                    {m}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">{fr.profile.neverBypass}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor={`${id}-parallel`}>{fr.profile.parallel}</Label>
                <Input
                  id={`${id}-parallel`}
                  type="number"
                  min={1}
                  max={16}
                  value={maxParallel}
                  onChange={(e) => setMaxParallel(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <p id={`${id}-subagents`} className="text-sm font-medium">
                  {fr.profile.subagents}
                </p>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  aria-labelledby={`${id}-subagents`}
                  value={subagents}
                  onValueChange={pickSubagents}
                  className="w-full"
                >
                  {AgentModel.options.map((m) => (
                    <ToggleGroupItem key={m} value={m} className="flex-1">
                      {fr.modelsShort[m]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{fr.profile.subagentsHelp(hostSlots)}</p>
            <ProfileGuidelines
              profile={profile}
              config={config}
              drafts={drafts}
              onDraftsChange={setDrafts}
              onError={setError}
              onFailure={(e) => setError(failure(e))}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <SheetFooter className="mt-auto flex-row items-center">
            {profile && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => void remove()}
              >
                {fr.profile.delete}
              </Button>
            )}
            <span className="flex-1" />
            <Button type="button" variant="outline" onClick={onClose}>
              {fr.common.cancel}
            </Button>
            <Button type="submit">{profile ? fr.profile.save : fr.profile.create}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
