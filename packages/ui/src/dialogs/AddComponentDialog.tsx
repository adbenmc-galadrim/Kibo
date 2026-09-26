import { type Binding, DEFAULT_WORKFLOW, type Layout, type Page, type Status } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { Blocks, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { nextLayout } from "../lib/next-layout";
import { BUILTIN_COMPONENTS, componentIcon } from "../registry";
import { navigateTo } from "../route";
import { useComponents } from "../state/use-components";
import { CatalogRow, CatalogSection, VersionPill } from "./CatalogRow";
import { Details } from "./ComponentDetails";
import { CreateComponentDialog } from "./CreateComponentDialog";
import { builtinChoices, type Choice, matches, mineChoices } from "./catalog-choices";
import { DraftRow } from "./DraftRow";
import { type SourceKind, SourcePicker } from "./sync/SourcePicker";
import { SyncSourceForm } from "./sync/SyncSourceForm";
import { EMPTY_SYNC_FORM, SYNCABLE_COMPONENTS, type SyncForm, toBindingConfig } from "./sync/status-map";
import { useSyncProgress } from "./sync/use-sync-progress";
import { TrustDialog, type TrustTarget, trustTargetOf } from "./TrustDialog";

type Props = {
  projectId: string;
  page: Page;
  taken: Layout[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPublishDraft?: (id: string) => void;
  workflow?: Status[];
};

const BUILTINS = builtinChoices(BUILTIN_COMPONENTS);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function AddComponentDialog({
  projectId,
  page,
  taken,
  open,
  onOpenChange,
  onPublishDraft,
  workflow = DEFAULT_WORKFLOW,
}: Props) {
  const a = fr.addComponent;
  const { components, drafts, error } = useComponents();
  const [query, setQuery] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [trust, setTrust] = useState<TrustTarget | null>(null);
  const [creating, setCreating] = useState(false);

  const mine = mineChoices(components ?? []);
  const shown = (c: Choice) => matches(`${c.title} ${c.description ?? ""}`, query);
  const shownBuiltins = BUILTINS.filter(shown);
  const shownMine = mine.filter(shown);
  const shownDrafts = (drafts ?? []).filter((d) => d.validated && matches(d.title, query));
  const selected = [...BUILTINS, ...mine].find((c) => c.ref === ref) ?? null;
  const [source, setSource] = useState<SourceKind>("local");
  const [form, setForm] = useState<SyncForm>(EMPTY_SYNC_FORM);
  const [connected, setConnected] = useState(false);
  const [binding, setBinding] = useState<Binding | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const progress = useSyncProgress(binding?.id ?? null);
  const syncable = selected !== null && SYNCABLE_COMPONENTS.includes(selected.id);
  const synced = syncable && source === "synced";
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

  useEffect(() => {
    if (!binding || !progress || progress.running) return;
    client
      .rpc({ method: "getSyncState", projectId })
      .then((s) => {
        const b = s.bindings.find((x) => x.bindingId === binding.id);
        if (b?.lastError) setSyncError(`${fr.integrations.source.failed} ${b.lastError.message}`);
        else onOpenChange(false);
      })
      .catch((e: unknown) => setSyncError(errorText(e)));
  }, [binding, progress, projectId, onOpenChange]);

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
          ...(page.kind === "dashboard" && { layout: nextLayout(taken) }),
          ...(created && { config: { source: { bindingId: created.id } } }),
        },
      });
      if (created) {
        setBinding(created);
        return;
      }
      onOpenChange(false);
    } catch (e) {
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
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
              {shownBuiltins.length + shownMine.length + shownDrafts.length === 0 && (
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
                            onChange={setForm}
                            onError={onFormError}
                          />
                        )}
                      </div>
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
          {progress && (
            <output className="text-sm text-muted-foreground">
              {progress.running
                ? fr.integrations.source.progress(progress.imported)
                : fr.integrations.source.done(progress.imported)}
            </output>
          )}
          {syncError && (
            <p role="alert" className="text-sm text-destructive">
              {syncError}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button
              disabled={!selected || (synced && toBindingConfig(form) === null) || binding !== null}
              onClick={submit}
            >
              {synced ? fr.integrations.source.submit : a.submit}
            </Button>
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
      <CreateComponentDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
