import type { MarketHit } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Card } from "@kibo/sdk/ui/card";
import { Package } from "lucide-react";
import { frMarket } from "../i18n/fr-market";
import { DetailsBlock } from "./DetailsBlock";
import { AMBER_TEXT, BLUE_BADGE } from "./market-tones";
import { PublisherMark } from "./PublisherMark";

function InstallBadge({ hit }: { hit: MarketHit }) {
  if (hit.updateAvailable)
    return (
      <Badge variant="outline" className={`font-normal ${BLUE_BADGE}`}>
        {frMarket.market.available(hit.updateAvailable)}
      </Badge>
    );
  if (!hit.installed) return null;
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {frMarket.market.installed(hit.installed)}
    </Badge>
  );
}

export function MarketCard({ hit, onOpen }: { hit: MarketHit; onOpen(): void }) {
  const verified = hit.publisher.verified;
  return (
    <Card className="relative gap-2 rounded-lg p-4 shadow-none transition-colors hover:bg-accent/40">
      <div className="flex items-center gap-2">
        <Package aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <button
          type="button"
          aria-label={frMarket.market.open(hit.title)}
          onClick={onOpen}
          className="truncate text-left text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {hit.title}
        </button>
        <span className="ml-auto">
          <InstallBadge hit={hit} />
        </span>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{hit.description}</p>
      <div className="mt-auto flex items-center gap-2 text-2xs">
        <Badge variant="secondary" className="rounded-sm px-1.5 font-medium">
          {frMarket.market.kind[hit.kind]}
        </Badge>
        <span className={`inline-flex items-center gap-1 ${verified ? "text-muted-foreground" : AMBER_TEXT}`}>
          <PublisherMark verified={verified} className="size-3" />
          {verified
            ? frMarket.market.verifiedBy(hit.sourceName)
            : frMarket.market.unverifiedBy(hit.sourceName)}
        </span>
        <span className="ml-auto font-mono text-muted-foreground">{hit.latest}</span>
      </div>
      <DetailsBlock label={frMarket.market.details} className="relative z-10">
        <span>{hit.id}</span>
      </DetailsBlock>
    </Card>
  );
}
