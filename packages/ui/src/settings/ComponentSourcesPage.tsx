import type { MarketSourceInfo, RpcRequest } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { Plus } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { client } from "../api";
import { AddSourceDialog } from "../dialogs/AddSourceDialog";
import { fr } from "../i18n/fr";
import { marketErrorText } from "../lib/market-errors";
import { isRemoteView } from "../lib/remote-view";
import { SettingsNav } from "./SettingsNav";
import { type SourceAction, SourceRow } from "./SourceRow";

const HEAD = "h-9 px-4 text-2xs font-normal text-muted-foreground";

const requestOf = (action: SourceAction, id: string): RpcRequest =>
  action === "remove" ? { method: "removeMarketSource", id } : { method: "refreshMarket" };

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
            <TableHead className={HEAD}>{t.key}</TableHead>
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

  const act = (id: string, action: SourceAction) => {
    setPending({ id, action });
    setError(null);
    client
      .rpc(requestOf(action, id))
      .then(load)
      .catch((e: unknown) => setError(marketErrorText(e)))
      .finally(() => setPending(null));
  };

  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="sources" />
      <div className="flex flex-col gap-4 p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <Button variant="outline" size="sm" disabled={remote} onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {t.add}
          </Button>
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
                onAction={(action) => act(s.id, action)}
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
      </div>
    </div>
  );
}
