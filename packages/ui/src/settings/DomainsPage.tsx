import {
  DOMAIN_COLORS,
  estimateTokens,
  type Guideline,
  type GuidelineOwner,
  GuidelinePath,
  KiboError,
  type ProjectSummary,
  type RpcRequest,
  type WorkspaceConfig,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@kibo/sdk/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kibo/sdk/ui/tabs";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Folder, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { DomainConfirmations, type DomainConfirming } from "./DomainConfirmations";
import { DomainHeader } from "./DomainHeader";
import { GuidelineFiles } from "./GuidelineFiles";
import { GuidelinePreview } from "./GuidelinePreview";
import { InjectionChain } from "./InjectionChain";
import { LevelButton } from "./LevelButton";
import { NewDomainForm } from "./NewDomainForm";
import { SettingsNav } from "./SettingsNav";

type Props = { config: WorkspaceConfig; projects: ProjectSummary[] };
type Level = { kind: "workspace" } | { kind: "project" } | { kind: "domain"; domainId: string };

const levelKey = (l: Level) => (l.kind === "domain" ? `domain:${l.domainId}` : l.kind);

const owns = (g: Guideline, owner: GuidelineOwner | null) => {
  if (!owner) return false;
  const o = g.owner;
  if (owner.scope === "workspace") return o.scope === "workspace";
  if (owner.scope === "project") return o.scope === "project" && o.projectId === owner.projectId;
  if (owner.scope === "domain") return o.scope === "domain" && o.domainId === owner.domainId;
  return o.scope === "profile" && o.profileId === owner.profileId;
};

export function DomainsPage({ config, projects }: Props) {
  const [level, setLevel] = useState<Level>(() =>
    config.domains[0] ? { kind: "domain", domainId: config.domains[0].id } : { kind: "workspace" },
  );
  const [projectId, setProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<DomainConfirming | null>(null);

  const project = projects.find((p) => p.id === projectId) ?? null;
  const domain =
    level.kind === "domain" ? (config.domains.find((d) => d.id === level.domainId) ?? null) : null;
  const ownerOf = (l: Level): GuidelineOwner | null => {
    if (l.kind === "workspace") return { scope: "workspace" };
    if (l.kind === "project") return projectId ? { scope: "project", projectId } : null;
    return { scope: "domain", domainId: l.domainId };
  };
  const owner = ownerOf(level);
  const filesOf = (l: Level) => config.guidelines.filter((g) => owns(g, ownerOf(l)));
  const files = filesOf(level);
  const selected = files.find((g) => g.id === selectedId) ?? files[0] ?? null;
  const content = selected ? (drafts[selected.id] ?? selected.content) : "";
  const title =
    level.kind === "workspace"
      ? fr.domains.workspace
      : level.kind === "project"
        ? fr.domains.project(project?.name ?? "")
        : fr.domains.domainTitle(domain?.name ?? "");
  const chainLevels: Level[] = [
    { kind: "workspace" },
    ...(level.kind !== "workspace" && projectId ? [{ kind: "project" } as const] : []),
    ...(level.kind === "domain" ? [level] : []),
  ];
  const chainLabel = (l: Level) =>
    l.kind === "workspace"
      ? fr.domains.chainWorkspace
      : l.kind === "project"
        ? fr.domains.chainProject(project?.name ?? "")
        : fr.domains.chainDomain(domain?.name ?? "");
  const tokens = chainLevels.flatMap(filesOf).reduce((n, g) => n + estimateTokens(g.content), 0);

  const send = async (req: RpcRequest): Promise<boolean> => {
    setError(null);
    try {
      await client.rpc(req);
      return true;
    } catch {
      setError(fr.domains.failed);
      return false;
    }
  };
  const pick = (l: Level) => {
    setLevel(l);
    setSelectedId(null);
    setError(null);
  };
  const save = async () => {
    if (!owner || !selected) return;
    const ok = await send({
      method: "config",
      command: { method: "updateGuideline", owner, guidelineId: selected.id, content },
    });
    if (ok) setDrafts(({ [selected.id]: _, ...rest }) => rest);
  };
  const addFile = async (path: string) => {
    if (!owner) return false;
    const parsed = GuidelinePath.safeParse(path);
    if (!parsed.success) {
      setError(fr.domains.invalidPath);
      return false;
    }
    return send({
      method: "config",
      command: { method: "addGuideline", owner, path: parsed.data, content: "" },
    });
  };
  const updateDomain = async (patch: { name?: string; color?: string }): Promise<boolean> => {
    if (!domain) return false;
    setError(null);
    try {
      await client.rpc({ method: "config", command: { method: "updateDomain", domainId: domain.id, patch } });
      return true;
    } catch (e) {
      setError(
        e instanceof KiboError && e.code === "INVALID_INPUT" ? fr.domains.duplicate : fr.domains.failed,
      );
      return false;
    }
  };
  const removeFile = () => {
    if (selected) setConfirming({ kind: "file", path: selected.path, guidelineId: selected.id });
  };
  const confirmRemoveFile = async (guidelineId: string) => {
    if (!owner) return;
    await client.rpc({ method: "config", command: { method: "removeGuideline", owner, guidelineId } });
  };
  const createDomain = (name: string) => {
    const color = DOMAIN_COLORS[config.domains.length % DOMAIN_COLORS.length] ?? DOMAIN_COLORS[0];
    return send({ method: "config", command: { method: "createDomain", domain: { name, color } } });
  };
  const deleteDomain = async () => {
    if (!domain) return;
    if ((config.domainUsage[domain.id] ?? 0) > 0) {
      setError(fr.domains.inUse);
      return;
    }
    setConfirming({ kind: "domain" });
  };
  const confirmDeleteDomain = async () => {
    if (!domain) return;
    await client.rpc({ method: "config", command: { method: "deleteDomain", domainId: domain.id } });
    pick({ kind: "workspace" });
  };

  const isActive = (l: Level) => levelKey(l) === levelKey(level);

  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="domains" />
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{fr.domains.title}</h1>
          <p className="text-sm text-muted-foreground">{fr.domains.subtitle}</p>
        </div>
        <div className="grid min-h-[32rem] flex-1 grid-cols-[17rem_1fr] gap-4">
          <nav
            aria-label={fr.domains.levels}
            className="grid content-start gap-1 rounded-lg border bg-card p-2"
          >
            <p className="px-2 text-3xs font-medium uppercase tracking-wide text-muted-foreground">
              {fr.domains.levels}
            </p>
            <LevelButton
              active={isActive({ kind: "workspace" })}
              icon={<LayoutGrid aria-hidden className="size-4" />}
              label={fr.domains.workspace}
              count={filesOf({ kind: "workspace" }).length}
              onClick={() => pick({ kind: "workspace" })}
            />
            <div className="flex items-center gap-1">
              <LevelButton
                active={isActive({ kind: "project" })}
                icon={<Folder aria-hidden className="size-4" />}
                label={fr.domains.project(project?.name ?? "")}
                count={filesOf({ kind: "project" }).length}
                onClick={() => pick({ kind: "project" })}
              />
              <Select
                value={projectId ?? ""}
                onValueChange={(v) => {
                  setProjectId(v);
                  pick({ kind: "project" });
                }}
              >
                <SelectTrigger aria-label={fr.domains.pickProject} size="sm" className="w-8 px-1.5" />
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="px-2 pt-2 text-3xs font-medium uppercase tracking-wide text-muted-foreground">
              {fr.domains.domains}
            </p>
            {config.domains.map((d) => (
              <LevelButton
                key={d.id}
                active={isActive({ kind: "domain", domainId: d.id })}
                icon={<span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: d.color }} />}
                label={d.name}
                onClick={() => pick({ kind: "domain", domainId: d.id })}
              />
            ))}
            <NewDomainForm onCreate={createDomain} />
          </nav>
          <section className="flex min-w-0 flex-col rounded-lg border bg-card">
            <Tabs defaultValue="edit" className="flex flex-1 flex-col gap-0">
              <header className="flex items-center gap-3 border-b px-4 py-3">
                {domain ? (
                  <DomainHeader
                    domain={domain}
                    usage={config.domainUsage[domain.id] ?? 0}
                    onRename={(name) => updateDomain({ name })}
                    onColor={(color) => updateDomain({ color })}
                    onDelete={() => void deleteDomain()}
                  />
                ) : (
                  <>
                    <h2 className="text-md font-semibold">{title}</h2>
                    <span className="flex-1" />
                  </>
                )}
                <TabsList>
                  <TabsTrigger value="edit">{fr.domains.edit}</TabsTrigger>
                  <TabsTrigger value="preview">{fr.domains.preview}</TabsTrigger>
                </TabsList>
              </header>
              <GuidelineFiles
                key={levelKey(level)}
                title={title}
                files={files}
                selectedId={selected?.id ?? null}
                canAdd={owner !== null}
                onSelect={setSelectedId}
                onAdd={addFile}
              />
              {error && (
                <p role="alert" className="px-4 pt-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              <TabsContent value="edit" className="flex flex-1 flex-col gap-2 p-4">
                {selected ? (
                  <>
                    <Textarea
                      aria-label={fr.domains.content(selected.path)}
                      value={content}
                      onChange={(e) => setDrafts((d) => ({ ...d, [selected.id]: e.target.value }))}
                      className="min-h-[18rem] flex-1 resize-none rounded-none border-none bg-transparent px-0 font-mono text-xs leading-5 shadow-none focus-visible:ring-0 md:text-xs dark:bg-transparent"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void save()}>
                        {fr.domains.save}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={removeFile}>
                        {fr.domains.removeFile}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{fr.domains.noFile}</p>
                )}
              </TabsContent>
              <TabsContent value="preview" className="flex-1 p-4">
                {selected ? (
                  <GuidelinePreview content={content} />
                ) : (
                  <p className="text-sm text-muted-foreground">{fr.domains.noFile}</p>
                )}
              </TabsContent>
              <InjectionChain labels={chainLevels.map(chainLabel)} tokens={tokens} />
            </Tabs>
          </section>
        </div>
      </div>
      <DomainConfirmations
        confirming={confirming}
        domain={domain}
        files={files.length}
        onClose={() => setConfirming(null)}
        onDeleteDomain={confirmDeleteDomain}
        onRemoveFile={confirmRemoveFile}
      />
    </div>
  );
}
