import { type MarketPackageDetail, type MarketVersionInfo, shortHash } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Fingerprint, type LucideIcon, Package, Store } from "lucide-react";
import type { ReactNode } from "react";
import { frMarket } from "../i18n/fr-market";
import { AMBER_TEXT, BLUE_BADGE } from "./market-tones";
import { PublisherMark } from "./PublisherMark";

function Fact({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-x-2 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-2">
        {icon}
        {children}
      </dd>
    </div>
  );
}

const iconOf = (Icon: LucideIcon) => <Icon aria-hidden className="size-3.5 text-muted-foreground" />;
const plainUrl = (url: string) => url.replace(/\/+$/, "");

export function PackageFacts({
  detail,
  sourceUrl,
}: {
  detail: MarketPackageDetail;
  sourceUrl: string | null;
}) {
  const t = frMarket.market;
  const { name, verified } = detail.publisher;
  return (
    <dl className="grid gap-2">
      <Fact label={t.publisher} icon={<PublisherMark verified={verified} />}>
        <span className={verified ? undefined : AMBER_TEXT}>
          {t.publisherLine(name, detail.sourceName, verified)}
        </span>
        {detail.newPublisher && (
          <Badge variant="outline" className={`font-normal ${BLUE_BADGE}`}>
            {t.newPublisher}
          </Badge>
        )}
      </Fact>
      <Fact label={t.source} icon={iconOf(Store)}>
        {sourceUrl ? t.sourceLine(detail.sourceName, plainUrl(sourceUrl)) : detail.sourceName}
      </Fact>
      <Fact label={t.size} icon={iconOf(Package)}>
        {t.ko(detail.size)}
      </Fact>
      <Fact label={t.hash} icon={iconOf(Fingerprint)}>
        <span className="font-mono">{t.hashText(shortHash(detail.hash))}</span>
      </Fact>
    </dl>
  );
}

const newestFirst = (versions: MarketVersionInfo[]) =>
  [...versions].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export function VersionList({ detail }: { detail: MarketPackageDetail }) {
  return (
    <ul aria-label={frMarket.market.versions} className="overflow-hidden rounded-lg border">
      {newestFirst(detail.versions).map((v) => (
        <li key={v.version} className="flex items-center gap-3 border-b px-3 py-2 text-xs last:border-b-0">
          <span className={v.revoked ? "font-mono text-muted-foreground line-through" : "font-mono"}>
            {v.version}
          </span>
          <span className="text-muted-foreground">{DATE.format(new Date(v.publishedAt))}</span>
          {v.revoked && (
            <span className="ml-auto text-destructive">{frMarket.market.revoked(v.revoked)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
