import type { McpSourceStoredConfig } from "@kibo/component-mcp-source";
import { DEFAULT_WORKFLOW, FORMAT_SIZES, KiboError, type Layout, type Page, type Status } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { Blocks, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { nextLayout } from "../lib/format-grid";
import { type TrustTarget, trustTargetOf } from "../lib/trust-target";
import { BUILTIN_COMPONENTS, componentIcon } from "../registry";
import { navigateTo } from "../route";
import { useComponents } from "../state/use-components";
import { ApprovalScope, useApprovalScope } from "./approval-scope";
import { CatalogRow, CatalogSection, VersionPill } from "./CatalogRow";
import { Details } from "./ComponentDetails";
import { CreateComponentDialog } from "./CreateComponentDialog";
import { builtinChoices, type Choice, matches, mineChoices } from "./catalog-choices";
import { DraftRow } from "./DraftRow";
import { MarketCatalogSection } from "./MarketCatalogSection";
import { McpSourceStep } from "./mcp-source/McpSourceStep";
import { FirstSyncStatus } from "./sync/FirstSyncStatus";
import { type LinkedRepos, repoKey } from "./sync/linked-repos";
import { type SourceKind, SourcePicker } from "./sync/SourcePicker";
import { SyncSourceForm } from "./sync/SyncSourceForm";
import { EMPTY_SYNC_FORM, SYNCABLE_COMPONENTS, type SyncForm, toBindingConfig } from "./sync/status-map";
import { useFirstSync } from "./sync/use-first-sync";
import { TrustDialog, trustTargetOfInstall } from "./TrustDialog";

type Props = {
  projectId: string;
  page: Page;
  taken: Layout[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPublishDraft?: (id: string) => void;
  workflow?: Status[];
  linked?: LinkedRepos;
};

const BUILTINS = builtinChoices(BUILTIN_COMPONENTS);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const NO_LINK: LinkedRepos = new Map();
const src = fr.integrations.source;

export function AddComponentDialog({
  projectId,
  page,
  taken,
  open,
  onOpenChange,
  onPublishDraft,
  workflow = DEFAULT_WORKFLOW,
  linked = NO_LINK,
}: Props) {
  const a = fr.addComponent;
  const { components, drafts, error } = useComponents();
  const [query, setQuery] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [trust, setTrust] = useState<TrustTarget | null>(null);
  const [creating, setCreating] = useState(false);
  const [marketCount, setMarketCount] = useState(0);
  const scope = useApprovalScope();

  const mine = mineChoices(components ?? []);
  const shown = (c: Choice) => matches(`${c.title} ${c.description ?? ""}`, query);
  const shownBuiltins = BUILTINS.filter(shown);
  const shownMine = mine.filter(shown);
  const shownDrafts = (drafts ?? []).filter((d) => d.validated && matches(d.title, query));
  const selected = [...BUILTINS, ...mine].find((c) => c.ref === ref) ?? null;
  const [source, setSource] = useState<SourceKind>("local");
  const [form, setForm] = useState<SyncForm>(EMPTY_SYNC_FORM);
  const [connected, setConnected] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const firstSync = useFirstSync(projectId, close);
  const syncable = selected !== null && SYNCABLE_COMPONENTS.includes(selected.id);
  const synced = syncable && source === "synced";
  const ownRepo = firstSync.binding?.config.repo ?? null;
  const others = useMemo(
    () => (ownRepo === null ? linked : new Map([...linked].filter(([k]) => k !== repoKey(ownRepo)))),
    [linked, ownRepo],
  );
  const holder = form.repo === null ? null : (others.get(repoKey(form.repo)) ?? null);
  const canRetry = firstSync.binding !== null && firstSync.error !== null;
  const [mcpConfig, setMcpConfig] = useState<McpSourceStoredConfig | null>(null);
  const mcpSource = selected?.id === "mcp-source";
  const onFormError = useCallback((m: string) => setSyncError(m), []);
  const openIntegrationSettings = () => {
    onOpenChange(false);
    navigateTo({ kind: "screen", screen: "integrations" });
  };

  useEffect(() => {
    if (!open || !syncable) return;
    client
      .rpc({ method: "getGithubConnectOptions" })
      .then((o) => setConnected(o.mode !== null))
      .catch((e: unknown) => setSyncError(errorText(e)));
  }, [open, syncable]);

  const addInstance = async (component: string) => {
    setFailed(false);
    setSyncError(null);
    try {
      const config = synced ? toBindingConfig(form) : null;
      const created = config ? await client.rpc({ method: "createBinding", projectId, config }) : null;
      await client.rpc({
        method: "command",
        projectId,
        command: {
          method: "addInstance",
          pageId: page.id,
          component,
          ...(page.kind === "dashboard" && { layout: nextLayout(taken, FORMAT_SIZES.large) }),
          ...(created && { config: { source: { bindingId: created.id } } }),
          ...(mcpSource && mcpConfig && { config: mcpConfig }),
        },
      });
      if (created) return firstSync.start(created);
      onOpenChange(false);
    } catch (e) {
      if (e instanceof KiboError && e.code === "CONFLICT")
        return setSyncError(src.alreadyBound(holder ?? fr.integrations.rows["github-issues"].title));
      console.error(e);
      setFailed(true);
    }
  };
  const submit = () => {
    if (!selected) return;
    if (!selected.pending) {
      void addInstance(selected.ref);
      return;
    }
    const target = trustTargetOf(selected.id, selected.title, selected.pending);
    setFailed(target === null);
    setTrust(target);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          hidden={scope.hidden}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl"
        >
          <DialogHeader>
            <DialogTitle>{a.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[1fr_1.1fr]">
            <div className="grid content-start gap-1">
              <div className="relative">
                <Search aria-hidden className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder={a.search}
                  aria-label={a.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <RadioGroup value={ref ?? ""} onValueChange={setRef} className="grid gap-0.5">
                {shownBuiltins.length > 0 && <CatalogSection label={a.builtin} />}
                {shownBuiltins.map((c) => (
                  <CatalogRow
                    key={c.ref}
                    value={c.ref}
                    icon={componentIcon(c.ref)}
                    title={c.title}
                    description={c.description}
                    aside={<VersionPill version={c.version} />}
                  />
                ))}
                {(shownMine.length > 0 || shownDrafts.length > 0) && <CatalogSection label={a.mine} />}
                {shownMine.map((c) => (
                  <CatalogRow
                    key={c.ref}
                    value={c.ref}
                    icon={Blocks}
                    title={c.title}
                    description={c.line}
                    aside={<VersionPill version={c.version} />}
                  />
                ))}
              </RadioGroup>
              {shownDrafts.map((d) => (
                <DraftRow key={d.id} draft={d} onPublish={onPublishDraft} />
              ))}
              <MarketCatalogSection
                query={query}
                onCount={setMarketCount}
                onInstalled={(r) => {
                  setRef(null);
                  setTrust(trustTargetOfInstall(r));
                }}
              />
              {shownBuiltins.length + shownMine.length + shownDrafts.length + marketCount === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">{a.noResult}</p>
              )}
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-1 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium hover:bg-accent/60"
              >
                <Sparkles aria-hidden className="size-4" />
                {a.create}
              </button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {a.loadFailed}
                </p>
              )}
            </div>
            <div className="grid content-start gap-4 rounded-lg border bg-muted/30 p-4 text-sm sm:max-h-[calc(100dvh-14rem)] sm:overflow-y-auto">
              {selected ? (
                <Details
                  choice={selected}
                  page={page}
                  source={
                    syncable ? (
                      <div className="grid gap-4">
                        <SourcePicker
                          value={source}
                          onValueChange={setSource}
                          connected={connected}
                          onOpenSettings={openIntegrationSettings}
                        />
                        {synced && (
                          <SyncSourceForm
                            workflow={workflow}
                            value={form}
                            linked={others}
                            onChange={setForm}
                            onError={onFormError}
                          />
                        )}
                      </div>
                    ) : mcpSource ? (
                      <McpSourceStep value={mcpConfig} onChange={setMcpConfig} />
                    ) : null
                  }
                />
              ) : (
                <p className="text-muted-foreground">{a.pick}</p>
              )}
            </div>
          </div>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {a.failed}
            </p>
          )}
          {(syncError ?? firstSync.error) && (
            <p role="alert" className="text-sm text-destructive">
              {syncError ?? firstSync.error}
            </p>
          )}
          <DialogFooter className="sm:items-center">
            <div className="sm:mr-auto">
              <FirstSyncStatus sync={firstSync} />
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            {canRetry ? (
              <Button onClick={() => void firstSync.retry()}>{src.retry}</Button>
            ) : (
              <Button
                disabled={
                  !selected ||
                  (synced && (toBindingConfig(form) === null || holder !== null)) ||
                  (mcpSource && mcpConfig === null) ||
                  firstSync.binding !== null
                }
                onClick={submit}
              >
                {synced ? src.submit : a.submit}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {trust && (
        <TrustDialog
          target={trust}
          mode="approveAndAdd"
          open
          onOpenChange={(o) => {
            if (!o) setTrust(null);
          }}
          onApproved={(v) => void addInstance(`${trust.id}@${v.version}`)}
        />
      )}
      <ApprovalScope scope={scope}>
        <CreateComponentDialog
          open={creating}
          onOpenChange={setCreating}
          target={{ projectId, pageId: page.id }}
          onAdded={() => onOpenChange(false)}
        />
      </ApprovalScope>
    </>
  );
}
