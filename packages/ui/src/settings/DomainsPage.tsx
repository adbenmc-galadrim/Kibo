import {
  DOMAIN_COLORS,
  estimateTokens,
  type Guideline,
  type GuidelineOwner,
  GuidelinePath,
  type ProjectSummary,
  type RpcRequest,
  type WorkspaceConfig,
} from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@kibo/sdk/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kibo/sdk/ui/tabs";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { ChevronRight, FileText, Folder, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { formatTokens } from "../agents/format";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { previewBlocks } from "./preview";
import { SettingsNav } from "./SettingsNav";

type Props = { config: WorkspaceConfig; projects: ProjectSummary[] };
type Level = { kind: "workspace" } | { kind: "project" } | { kind: "domain"; domainId: string };

const owns = (g: Guideline, owner: GuidelineOwner | null) => {
  if (!owner) return false;
  const o = g.owner;
  if (owner.scope === "workspace") return o.scope === "workspace";
  if (owner.scope === "project") return o.scope === "project" && o.projectId === owner.projectId;
  if (owner.scope === "domain") return o.scope === "domain" && o.domainId === owner.domainId;
  return o.scope === "profile" && o.profileId === owner.profileId;
};

function Preview({ content }: { content: string }) {
  return (
    <div className="grid content-start gap-2 text-sm">
      {previewBlocks(content).map((b, i) => {
        const key = `${i}-${b.kind}`;
        if (b.kind === "h1")
          return (
            <h3 key={key} className="text-lg font-semibold">
              {b.text}
            </h3>
          );
        if (b.kind === "h2")
          return (
            <h4 key={key} className="font-semibold">
              {b.text}
            </h4>
          );
        if (b.kind === "li")
          return (
            <p key={key} className="pl-4 before:-ml-3 before:mr-2 before:content-['•']">
              {b.text}
            </p>
          );
        return <p key={key}>{b.text}</p>;
      })}
    </div>
  );
}

export function DomainsPage({ config, projects }: Props) {
  const id = useId();
  const [level, setLevel] = useState<Level>(() =>
    config.domains[0] ? { kind: "domain", domainId: config.domains[0].id } : { kind: "workspace" },
  );
  const [projectId, setProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [path, setPath] = useState("");
  const [creating, setCreating] = useState(false);
  const [domainName, setDomainName] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    setAdding(false);
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
  const addFile = async (e: FormEvent) => {
    e.preventDefault();
    if (!owner) return;
    const parsed = GuidelinePath.safeParse(path.trim());
    if (!parsed.success) {
      setError(fr.domains.invalidPath);
      return;
    }
    const ok = await send({
      method: "config",
      command: { method: "addGuideline", owner, path: parsed.data, content: "" },
    });
    if (ok) {
      setPath("");
      setAdding(false);
    }
  };
  const removeFile = () => {
    if (owner && selected) {
      void send({
        method: "config",
        command: { method: "removeGuideline", owner, guidelineId: selected.id },
      });
    }
  };
  const createDomain = async (e: FormEvent) => {
    e.preventDefault();
    const name = domainName.trim();
    if (!name) return;
    const color = DOMAIN_COLORS[config.domains.length % DOMAIN_COLORS.length] ?? DOMAIN_COLORS[0];
    const ok = await send({ method: "config", command: { method: "createDomain", domain: { name, color } } });
    if (ok) {
      setDomainName("");
      setCreating(false);
    }
  };
  const deleteDomain = async () => {
    if (!domain) return;
    if ((config.domainUsage[domain.id] ?? 0) > 0) {
      setError(fr.domains.inUse);
      return;
    }
    if (await send({ method: "config", command: { method: "deleteDomain", domainId: domain.id } })) {
      pick({ kind: "workspace" });
    }
  };

  const levelButton = (l: Level, icon: ReactNode, label: string, count: number) => {
    const active =
      l.kind === level.kind &&
      (l.kind !== "domain" || (level.kind === "domain" && l.domainId === level.domainId));
    return (
      <button
        key={l.kind === "domain" ? l.domainId : l.kind}
        type="button"
        aria-pressed={active}
        onClick={() => pick(l)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
          active && "bg-accent",
        )}
      >
        {icon}
        <span className="flex-1 truncate">{label}</span>{" "}
        {count >= 0 && (
          <span className="font-mono text-xs text-muted-foreground">{fr.domains.count(count)}</span>
        )}
      </button>
    );
  };

  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="domains" />
      <div className="grid content-start gap-4 p-8">
        <div>
          <h1 className="text-2xl font-semibold">{fr.domains.title}</h1>
          <p className="text-sm text-muted-foreground">{fr.domains.subtitle}</p>
        </div>
        <div className="grid min-h-[32rem] grid-cols-[17rem_1fr] gap-4">
          <nav
            aria-label={fr.domains.levels}
            className="grid content-start gap-1 rounded-lg border bg-card p-2"
          >
            <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {fr.domains.levels}
            </p>
            {levelButton(
              { kind: "workspace" },
              <LayoutGrid aria-hidden className="size-4" />,
              fr.domains.workspace,
              filesOf({ kind: "workspace" }).length,
            )}
            <div className="flex items-center gap-1">
              {levelButton(
                { kind: "project" },
                <Folder aria-hidden className="size-4" />,
                fr.domains.project(project?.name ?? ""),
                filesOf({ kind: "project" }).length,
              )}
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
            <p className="px-2 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {fr.domains.domains}
            </p>
            {config.domains.map((d) =>
              levelButton(
                { kind: "domain", domainId: d.id },
                <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: d.color }} />,
                d.name,
                -1,
              ),
            )}
            {creating ? (
              <form onSubmit={createDomain} className="grid gap-2 px-2 pt-1">
                <label htmlFor={`${id}-domain`} className="sr-only">
                  {fr.domains.domainName}
                </label>
                <Input
                  id={`${id}-domain`}
                  value={domainName}
                  placeholder={fr.domains.domainName}
                  onChange={(e) => setDomainName(e.target.value)}
                  autoFocus
                />
                <Button type="submit" size="sm" disabled={!domainName.trim()}>
                  {fr.domains.create}
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
              >
                <Plus aria-hidden className="size-4" />
                {fr.domains.newDomain}
              </button>
            )}
          </nav>
          <section className="flex min-w-0 flex-col rounded-lg border bg-card">
            <Tabs defaultValue="edit" className="flex flex-1 flex-col gap-0">
              <header className="flex items-center gap-3 border-b px-4 py-3">
                {domain && (
                  <span aria-hidden className="size-3 rounded-[3px]" style={{ background: domain.color }} />
                )}
                <h2 className="font-semibold">{title}</h2>
                {domain && (
                  <span className="text-sm text-muted-foreground">
                    {fr.domains.usedBy(config.domainUsage[domain.id] ?? 0)}
                  </span>
                )}
                <span className="flex-1" />
                {domain && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={fr.domains.deleteDomain(domain.name)}
                    onClick={() => void deleteDomain()}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
                <TabsList>
                  <TabsTrigger value="edit">{fr.domains.edit}</TabsTrigger>
                  <TabsTrigger value="preview">{fr.domains.preview}</TabsTrigger>
                </TabsList>
              </header>
              <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
                <ul aria-label={title} className="flex flex-wrap gap-2">
                  {files.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        aria-pressed={g.id === selected?.id}
                        onClick={() => setSelectedId(g.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs underline underline-offset-2",
                          g.id === selected?.id && "bg-accent",
                        )}
                      >
                        <FileText aria-hidden className="size-3.5" />
                        {g.path}
                      </button>
                    </li>
                  ))}
                </ul>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-7"
                  aria-label={fr.domains.addFile}
                  disabled={!owner}
                  onClick={() => setAdding(true)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              {adding && (
                <form onSubmit={addFile} className="flex items-center gap-2 px-4 pt-3">
                  <label htmlFor={`${id}-path`} className="sr-only">
                    {fr.domains.filePath}
                  </label>
                  <Input
                    id={`${id}-path`}
                    value={path}
                    placeholder={fr.domains.filePlaceholder}
                    className="font-mono text-xs"
                    onChange={(e) => setPath(e.target.value)}
                    autoFocus
                  />
                  <Button type="submit" size="sm" disabled={!path.trim()}>
                    {fr.domains.add}
                  </Button>
                </form>
              )}
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
                      className="min-h-[18rem] flex-1 font-mono text-xs"
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
                  <Preview content={content} />
                ) : (
                  <p className="text-sm text-muted-foreground">{fr.domains.noFile}</p>
                )}
              </TabsContent>
              <footer className="flex items-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
                <span id={`${id}-chain`}>{fr.domains.injection}</span>
                <ol aria-labelledby={`${id}-chain`} className="flex items-center gap-2">
                  {chainLevels.map((l, i) => (
                    <li key={l.kind} className="flex items-center gap-2">
                      {i > 0 && <ChevronRight aria-hidden className="size-3" />}
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5",
                          i === chainLevels.length - 1 && "border-teal-500 text-foreground",
                        )}
                      >
                        {chainLabel(l)}
                      </span>
                    </li>
                  ))}
                </ol>
                <span className="flex-1" />
                <span className="font-mono">{fr.domains.tokens(formatTokens(tokens))}</span>
              </footer>
            </Tabs>
          </section>
        </div>
      </div>
    </div>
  );
}
