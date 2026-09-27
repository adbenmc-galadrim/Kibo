import type { MarketTrustInfo } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { AMBER_TEXT, BLUE_BADGE } from "../components-page/market-tones";
import { PublisherMark } from "../components-page/PublisherMark";
import { fr } from "../i18n/fr";

export function MarketSubtitle({ market }: { market: MarketTrustInfo }) {
  const { publisherName, sourceName, verified, newPublisher } = market;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <PublisherMark verified={verified} />
      <span className={verified ? undefined : AMBER_TEXT}>
        {fr.market.publishedBy(publisherName, sourceName, verified)}
      </span>
      {newPublisher && (
        <Badge variant="outline" className={`font-normal ${BLUE_BADGE}`}>
          {fr.market.newPublisher}
        </Badge>
      )}
    </div>
  );
}
