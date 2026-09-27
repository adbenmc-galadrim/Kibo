import type { ComponentKind, MarketInstallResult } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { MarketCard } from "./MarketCard";
import { MarketFilters } from "./MarketFilters";
import { MarketInstallFlow } from "./MarketInstallFlow";
import type { MarketTarget } from "./MarketPackageSheet";
import { useMarketHits, useMarketSources } from "./use-market-hits";

function Empty({ text }: { text: string }) {
  return <p className="p-8 text-center text-sm text-muted-foreground">{text}</p>;
}

export function MarketplaceTab({ onInstalled }: { onInstalled(result: MarketInstallResult): void }) {
  const t = fr.market;
  const { sources, error: loadError } = useMarketSources();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ComponentKind | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [target, setTarget] = useState<MarketTarget | null>(null);
  const { hits, error } = useMarketHits(sources, { query, sourceId, kind });

  if (sources?.length === 0) return <Empty text={t.noSource} />;
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
