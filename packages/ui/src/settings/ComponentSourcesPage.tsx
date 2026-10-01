import type { MarketSourceInfo, RpcRequest } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { Plus, RefreshCw } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { client } from "../api";
import { AddSourceDialog } from "../dialogs/AddSourceDialog";
import { fr } from "../i18n/fr";
import { marketErrorText } from "../lib/market-errors";
import { isRemoteView } from "../lib/remote-view";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { SettingsLayout } from "./SettingsLayout";
import { type SourceAction, SourceRow } from "./SourceRow";

const HEAD = "h-9 px-4 text-2xs font-normal text-muted-foreground";

const requestOf = (action: SourceAction, id: string): RpcRequest =>
  action === "remove" ? { method: "removeMarketSource", id } : { method: "refreshMarketSource", id };

function useSources() {
  const [sources, setSources] = useState<MarketSourceInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    client
      .rpc({ method: "listMarketSources" })
      .then(setSources)
      .catch((e: unknown) => setError(marketErrorText(e)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { sources, error, setError, load };
}

function SourcesTable({ children }: { children: ReactNode }) {
  const t = fr.marketSources;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={HEAD}>{t.name}</TableHead>
            <TableHead className={HEAD}>{t.url}</TableHead>
            <TableHead className={HEAD}>{t.serial}</TableHead>
            <TableHead className={HEAD}>{t.updated}</TableHead>
            <TableHead className={HEAD}>{t.state}</TableHead>
            <TableHead className={`${HEAD} w-12`} />
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

export function ComponentSourcesPage({ remote = isRemoteView() }: { remote?: boolean }) {
  const t = fr.marketSources;
  const { sources, error, setError, load } = useSources();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<{ id: string; action: SourceAction } | null>(null);
  const [removing, setRemoving] = useState<MarketSourceInfo | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const act = async (id: string, action: SourceAction) => {
    setPending({ id, action });
    setError(null);
    try {
      await client.rpc(requestOf(action, id));
      load();
    } finally {
      setPending(null);
    }
  };
  const refresh = (id: string) => {
    act(id, "refresh").catch((e: unknown) => setError(marketErrorText(e)));
  };
  const refreshAll = () => {
    setRefreshingAll(true);
    setError(null);
    client
      .rpc({ method: "refreshMarket" })
      .then(load)
      .catch((e: unknown) => setError(marketErrorText(e)))
      .finally(() => setRefreshingAll(false));
  };

  return (
    <SettingsLayout active="sources">
      <div className="flex flex-col gap-4 p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={refreshingAll || !sources?.length}
              onClick={refreshAll}
            >
              <RefreshCw aria-hidden className={refreshingAll ? "animate-spin" : undefined} />
              {t.refreshAll}
            </Button>
            <Button variant="outline" size="sm" disabled={remote} onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              {t.add}
            </Button>
          </div>
        </div>
        {remote && <p className="text-sm text-muted-foreground">{t.localOnly}</p>}
        {sources?.length === 0 && <p className="text-sm text-muted-foreground">{t.empty}</p>}
        {sources && sources.length > 0 && (
          <SourcesTable>
            {sources.map((s) => (
              <SourceRow
                key={s.id}
                source={s}
                pending={pending?.id === s.id ? pending.action : null}
                remote={remote}
                now={Date.now()}
                onAction={(action) => (action === "remove" ? setRemoving(s) : refresh(s.id))}
              />
            ))}
          </SourcesTable>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-2xs text-muted-foreground">{t.footnote}</p>
        {adding && <AddSourceDialog open onOpenChange={setAdding} onAdded={load} />}
        {removing && (
          <ConfirmDialog
            open
            onOpenChange={(o) => !o && setRemoving(null)}
            title={t.removeTitle(removing.name)}
            description={t.removeHelp}
            confirmLabel={t.removeConfirm}
            cancelLabel={t.cancel}
            onConfirm={() => act(removing.id, "remove")}
            describeError={marketErrorText}
          />
        )}
      </div>
    </SettingsLayout>
  );
}
