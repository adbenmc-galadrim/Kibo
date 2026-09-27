import type { ComponentKind, MarketHit, MarketInstallResult } from "@kibo/schema";
import { Package } from "lucide-react";
import { useEffect, useState } from "react";
import { MarketFilters } from "../components-page/MarketFilters";
import { MarketInstallFlow } from "../components-page/MarketInstallFlow";
import type { MarketTarget } from "../components-page/MarketPackageSheet";
import { useMarketHits, useMarketSources } from "../components-page/use-market-hits";
import { fr } from "../i18n/fr";
import { CatalogSection, VersionPill } from "./CatalogRow";

type Props = {
  query: string;
  onCount(count: number): void;
  onInstalled(result: MarketInstallResult): void;
  remote?: boolean;
};

function Failure({ text }: { text: string }) {
  return (
    <p role="alert" className="px-1 text-sm text-destructive">
      {text}
    </p>
  );
}

function MarketRow({ hit, onOpen }: { hit: MarketHit; onOpen(): void }) {
  const t = fr.market;
  return (
    <button
      type="button"
      aria-label={t.open(hit.title)}
      onClick={onOpen}
      className="flex items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background">
        <Package aria-hidden className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-sm font-medium leading-none">{hit.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {t.catalogLine(hit.id, hit.sourceName, hit.publisher.verified)}
        </span>
      </span>
      <VersionPill version={hit.latest} />
    </button>
  );
}

export function MarketCatalogSection({ query, onCount, onInstalled, remote }: Props) {
  const { sources, error: loadError } = useMarketSources();
  const [kind, setKind] = useState<ComponentKind | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [target, setTarget] = useState<MarketTarget | null>(null);
  const { hits, error } = useMarketHits(sources, { query, sourceId, kind });
  const shown = (hits ?? []).filter((h) => h.kind !== "adapter");
  const count = sources?.length ? shown.length : 0;
  useEffect(() => onCount(count), [onCount, count]);

  const failure = error ?? loadError;
  if (!sources?.length) return failure ? <Failure text={failure} /> : null;
  return (
    <div className="grid gap-0.5">
      <div className="flex items-center gap-1.5">
        <CatalogSection label={fr.market.tabMarket} />
        <span className="ml-auto flex gap-1.5 pt-2">
          <MarketFilters
            sources={sources}
            sourceId={sourceId}
            kind={kind}
            onSource={setSourceId}
            onKind={setKind}
            compact
          />
        </span>
      </div>
      {shown.map((h) => (
        <MarketRow
          key={`${h.sourceId}/${h.id}`}
          hit={h}
          onOpen={() => setTarget({ sourceId: h.sourceId, id: h.id, version: h.latest })}
        />
      ))}
      {failure && <Failure text={failure} />}
      <MarketInstallFlow
        target={target}
        onTarget={setTarget}
        onInstalled={onInstalled}
        {...(remote !== undefined && { remote })}
      />
    </div>
  );
}
