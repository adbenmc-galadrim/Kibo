import {
  AgentModel,
  AgentProfile,
  GuidelinePath,
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
import { Textarea } from "@kibo/sdk/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { FileText, X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

type Props = {
  profile: AgentProfile | null;
  config: WorkspaceConfig;
  hostSlots: number;
  onClose: () => void;
};
type Draft = { id: string; path: string; content: string };

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
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saved = profile
    ? config.guidelines.filter((g) => g.owner.scope === "profile" && g.owner.profileId === profile.id)
    : [];
  const listed: Draft[] = profile ? saved : drafts;

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

  const addGuideline = async () => {
    setError(null);
    const parsed = GuidelinePath.safeParse(path.trim());
    if (!parsed.success) {
      setError(fr.profile.invalidPath);
      return;
    }
    if (!profile) {
      setDrafts((d) => [...d, { id: crypto.randomUUID(), path: parsed.data, content }]);
    } else {
      try {
        await client.rpc({
          method: "config",
          command: {
            method: "addGuideline",
            owner: { scope: "profile", profileId: profile.id },
            path: parsed.data,
            content,
          },
        });
      } catch (e) {
        setError(failure(e));
        return;
      }
    }
    setPath("");
    setContent("");
  };

  const removeGuideline = async (guidelineId: string) => {
    setError(null);
    if (!profile) {
      setDrafts((d) => d.filter((g) => g.id !== guidelineId));
      return;
    }
    try {
      await client.rpc({
        method: "config",
        command: {
          method: "removeGuideline",
          owner: { scope: "profile", profileId: profile.id },
          guidelineId,
        },
      });
    } catch (e) {
      setError(failure(e));
    }
  };

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
            <div className="grid gap-2">
              <p className="text-sm font-medium">{fr.profile.guidelines}</p>
              <ul className="grid gap-1.5">
                {listed.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                    <FileText aria-hidden className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{g.path}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      aria-label={fr.profile.removeGuideline(g.path)}
                      onClick={() => void removeGuideline(g.id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="grid gap-2 rounded-md border border-dashed p-2.5">
                <Label htmlFor={`${id}-path`}>{fr.profile.guidelinePath}</Label>
                <Input
                  id={`${id}-path`}
                  value={path}
                  placeholder="guidelines/front.md"
                  onChange={(e) => setPath(e.target.value)}
                />
                <Label htmlFor={`${id}-content`}>{fr.profile.guidelineContent}</Label>
                <Textarea
                  id={`${id}-content`}
                  value={content}
                  rows={3}
                  className="font-mono text-xs"
                  onChange={(e) => setContent(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  disabled={!path.trim()}
                  onClick={() => void addGuideline()}
                >
                  {fr.profile.addGuideline}
                </Button>
              </div>
            </div>
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
