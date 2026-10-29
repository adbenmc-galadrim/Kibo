import {
  DEFAULT_WORKFLOW,
  defaultFormatOf,
  FORMAT_SIZES,
  type FormatSize,
  KiboError,
  type Layout,
  type Page,
  type Status,
  splitRef,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frComponentsManage } from "../i18n/fr-components-manage";
import { frIntegrations } from "../i18n/fr-integrations";
import { nextLayout } from "../lib/format-grid";
import { BUILTIN_COMPONENTS, findBuiltin } from "../registry";
import { navigateTo } from "../route";
import { AddComponentList } from "./AddComponentList";
import { Details } from "./ComponentDetails";
import { builtinChoices, type Choice, matches } from "./catalog-choices";
import { FirstSyncStatus } from "./sync/FirstSyncStatus";
import { type LinkedRepos, repoKey } from "./sync/linked-repos";
import { type SourceKind, SourcePicker } from "./sync/SourcePicker";
import { SyncSourceForm } from "./sync/SyncSourceForm";
import { EMPTY_SYNC_FORM, SYNCABLE_COMPONENTS, type SyncForm, toBindingConfig } from "./sync/status-map";
import { useFirstSync } from "./sync/use-first-sync";

type Props = {
  projectId: string;
  page: Page;
  taken: Layout[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workflow?: Status[];
  linked?: LinkedRepos;
};

const BUILTINS = builtinChoices(BUILTIN_COMPONENTS);
const sizeOf = (ref: string): FormatSize => {
  const manifest = findBuiltin(splitRef(ref).id)?.manifest;
  return manifest ? FORMAT_SIZES[defaultFormatOf(manifest)] : FORMAT_SIZES.large;
};
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const NO_LINK: LinkedRepos = new Map();
const src = frIntegrations.source;

export function AddComponentDialog({
  projectId,
  page,
  taken,
  open,
  onOpenChange,
  workflow = DEFAULT_WORKFLOW,
  linked = NO_LINK,
}: Props) {
  const a = frComponentsManage.addComponent;
  const [query, setQuery] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const shown = (c: Choice) => matches(`${c.title} ${c.description ?? ""}`, query);
  const shownBuiltins = BUILTINS.filter(shown);
  const selected = BUILTINS.find((c) => c.ref === ref) ?? null;
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
          ...(page.kind === "dashboard" && { layout: nextLayout(taken, sizeOf(component)) }),
          ...(created && { config: { source: { bindingId: created.id } } }),
        },
      });
      if (created) return firstSync.start(created);
      onOpenChange(false);
    } catch (e) {
      if (e instanceof KiboError && e.code === "CONFLICT")
        return setSyncError(src.alreadyBound(holder ?? frIntegrations.rows["github-issues"].title));
      console.error(e);
      setFailed(true);
    }
  };
  const submit = () => {
    if (selected) void addInstance(selected.ref);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(46rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="gap-3 border-b px-6 pt-6 pb-4">
          <DialogTitle>{a.title}</DialogTitle>
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
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-rows-2 min-[720px]:grid-cols-[1fr_1.1fr] min-[720px]:grid-rows-1">
          <AddComponentList builtins={shownBuiltins} selected={ref} onSelect={setRef} />
          <section
            aria-label={a.detailsLabel}
            className="grid min-h-0 content-start gap-4 overflow-y-auto bg-muted/30 p-4 text-sm"
          >
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
                  ) : null
                }
              />
            ) : (
              <p className="text-muted-foreground">{a.pick}</p>
            )}
          </section>
        </div>
        <div className="grid gap-2 border-t px-6 py-4">
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
                  firstSync.binding !== null
                }
                onClick={submit}
              >
                {synced ? src.submit : a.submit}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
