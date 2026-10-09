import type { ComponentKind, MarketInstallResult } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Plus, Search, Store } from "lucide-react";
import { useState } from "react";
import { AddSourceDialog } from "../dialogs/AddSourceDialog";
import { frMarket } from "../i18n/fr-market";
import { isRemoteView } from "../lib/remote-view";
import { targetToHash } from "../tabs/target-hash";
import { MarketCard } from "./MarketCard";
import { MarketFilters } from "./MarketFilters";
import { MarketInstallFlow } from "./MarketInstallFlow";
import type { MarketTarget } from "./MarketPackageSheet";
import { useMarketHits, useMarketSources } from "./use-market-hits";

function Empty({ text }: { text: string }) {
  return <p className="p-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function EmptySources({ remote, onAdded }: { remote: boolean; onAdded(): void }) {
  const t = frMarket.market;
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <Store aria-hidden className="size-6 text-muted-foreground" />
      <div className="grid gap-1">
        <p className="text-sm font-medium">{t.noSource}</p>
        <p className="max-w-md text-sm text-muted-foreground">{t.noSourceHelp}</p>
      </div>
      {remote ? (
        <p className="max-w-md text-xs text-muted-foreground">{frMarket.marketSources.localOnly}</p>
      ) : (
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          {t.addSource}
        </Button>
      )}
      <a
        href={targetToHash({ kind: "screen", screen: "sources" })}
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {t.manageSources}
      </a>
      {adding && <AddSourceDialog open onOpenChange={setAdding} onAdded={onAdded} />}
    </div>
  );
}

type Props = { onInstalled(result: MarketInstallResult): void; remote?: boolean };

export function MarketplaceTab({ onInstalled, remote = isRemoteView() }: Props) {
  const t = frMarket.market;
  const { sources, error: loadError, reload } = useMarketSources();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ComponentKind | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [target, setTarget] = useState<MarketTarget | null>(null);
  const { hits, error } = useMarketHits(sources, { query, sourceId, kind });

  if (sources?.length === 0) return <EmptySources remote={remote} onAdded={reload} />;
  const shown = error ?? loadError;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search
            aria-hidden
            className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={t.search}
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <MarketFilters
          sources={sources ?? []}
          sourceId={sourceId}
          kind={kind}
          onSource={setSourceId}
          onKind={setKind}
        />
        {sources && hits && (
          <span className="ml-auto text-xs text-muted-foreground">
            {t.count(sources.length, hits.length)}
          </span>
        )}
      </div>
      {shown && (
        <p role="alert" className="text-sm text-destructive">
          {shown}
        </p>
      )}
      {hits?.length === 0 ? (
        <Empty text={t.noResult} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(hits ?? []).map((h) => (
            <MarketCard
              key={`${h.sourceId}/${h.id}`}
              hit={h}
              onOpen={() => setTarget({ sourceId: h.sourceId, id: h.id, version: h.latest })}
            />
          ))}
        </div>
      )}
      <MarketInstallFlow target={target} onTarget={setTarget} onInstalled={onInstalled} />
    </div>
  );
}
