import { grantedOf, type TabTarget } from "@kibo/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kibo/sdk/ui/tabs";
import { TooltipProvider } from "@kibo/sdk/ui/tooltip";
import { useState } from "react";
import { TrustDialog, trustTargetOfInstall } from "../dialogs/TrustDialog";
import { frComponentsList } from "../i18n/fr-components-list";
import { frComponentsManage } from "../i18n/fr-components-manage";
import { frMarket } from "../i18n/fr-market";
import { type TrustTarget, trustTargetOf } from "../lib/trust-target";
import { type FlashTone, useFlash } from "../lib/use-flash";
import { useComponents } from "../state/use-components";
import { useMarketStatus } from "../state/use-market-status";
import { ComponentsFilters } from "./ComponentsFilters";
import { ComponentsTable } from "./ComponentsTable";
import { DraftsSection } from "./DraftsSection";
import { type ComponentsQuery, DEFAULT_QUERY, filterComponents, toggleSort } from "./filter-components";
import { MarketplaceTab } from "./MarketplaceTab";
import { MarketUpdateDialog } from "./MarketUpdateDialog";
import { PublishDialog } from "./PublishDialog";
import { type PublishTarget, PublishToMarketDialog } from "./PublishToMarketDialog";
import { type ComponentRow, componentRows } from "./rows";
import { SandboxBanner } from "./SandboxBanner";
import { useComponentsSort } from "./sort-pref";
import { UsagesSheet, type UsagesTarget } from "./UsagesSheet";

const TAB =
  "h-8 flex-none px-3 text-sm font-normal text-muted-foreground data-[state=active]:bg-accent data-[state=active]:font-medium data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-accent";

type Updating = { row: ComponentRow; to: string };

function publishTarget(row: ComponentRow): PublishTarget | null {
  const s = row.summary;
  if (!s?.hash || !s.manifest) return null;
  return {
    id: row.id,
    title: row.title,
    version: row.version,
    hash: s.hash,
    permissions: grantedOf(s.manifest),
  };
}

function PageHeader() {
  const t = frComponentsList;
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid max-w-2xl gap-1">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>
    </header>
  );
}

export type ComponentsPageProps = { onOpen(target: TabTarget): void };

export function ComponentsPage({ onOpen }: ComponentsPageProps) {
  const c = frComponentsManage.components;
  const { components, drafts, error, reload } = useComponents();
  const { message, tone, flash } = useFlash();
  const [publishing, setPublishing] = useState<string | null>(null);
  const [trust, setTrust] = useState<TrustTarget | null>(null);
  const [updating, setUpdating] = useState<Updating | null>(null);
  const [toMarket, setToMarket] = useState<PublishTarget | null>(null);
  const [filters, setFilters] = useState<ComponentsQuery>(DEFAULT_QUERY);
  const [sort, setSort] = useComponentsSort();
  const query: ComponentsQuery = { ...filters, ...sort };
  const [usages, setUsages] = useState<UsagesTarget | null>(null);
  const { statuses, reload: reloadMarket } = useMarketStatus();
  const rows = components ? componentRows(components, statuses) : null;
  const shown = rows ? filterComponents(rows, query) : [];

  const review = (row: ComponentRow) => {
    const target = row.summary ? trustTargetOf(row.id, row.title, row.summary) : null;
    if (target) setTrust(target);
  };
  const done = (m: string, t: FlashTone) => {
    flash(m, t);
    reload();
  };
  const openPage = (projectId: string, pageId: string) => {
    setUsages(null);
    setPublishing(null);
    onOpen({ kind: "page", projectId, pageId });
  };

  return (
    <TooltipProvider>
      <div className="grid content-start gap-4 p-6">
        <PageHeader />
        <Tabs defaultValue="installed" className="gap-4">
          <TabsList className="h-auto gap-1 bg-transparent p-0">
            <TabsTrigger value="installed" className={TAB}>
              {frMarket.market.tabInstalled}
            </TabsTrigger>
            <TabsTrigger value="market" className={TAB}>
              {frMarket.market.tabMarket}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="installed" className="grid content-start gap-6">
            <SandboxBanner />
            <ComponentsFilters query={query} onChange={setFilters} />
            <div className="overflow-hidden rounded-lg border bg-card">
              <ComponentsTable
                rows={shown}
                query={query}
                onSort={(key) => {
                  const next = toggleSort(query, key);
                  setSort({ sort: next.sort, descending: next.descending });
                }}
                onUsages={(row) => setUsages({ ...row, manifest: row.summary?.manifest ?? null })}
                onReview={review}
                onUpdate={(row, to) => setUpdating({ row, to })}
                onDone={done}
                onPublishToMarket={(row) => setToMarket(publishTarget(row))}
              />
              {rows === null && !error && (
                <p className="px-4 py-3 text-sm text-muted-foreground">{c.loading}</p>
              )}
              {rows !== null && shown.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {frComponentsList.noMatch}
                </p>
              )}
            </div>
            {rows?.every((r) => r.builtin) && <p className="text-sm text-muted-foreground">{c.empty}</p>}
            {message && (
              <p
                role={tone === "error" ? "alert" : "status"}
                className={`text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
              >
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {c.failed}
              </p>
            )}
            <DraftsSection drafts={drafts ?? []} onPublish={setPublishing} />
          </TabsContent>
          <TabsContent value="market">
            <MarketplaceTab
              onInstalled={(r) => {
                setTrust(trustTargetOfInstall(r));
                reload();
              }}
            />
          </TabsContent>
          {publishing && (
            <PublishDialog
              id={publishing}
              open
              onOpenChange={(o) => !o && setPublishing(null)}
              onPublished={reload}
              onOpenPage={openPage}
            />
          )}
          {updating?.row.summary && updating.row.market && (
            <MarketUpdateDialog
              title={updating.row.title}
              summary={updating.row.summary}
              sourceId={updating.row.market.sourceId}
              componentId={updating.row.id}
              to={updating.to}
              onDone={() => {
                setUpdating(null);
                reload();
                reloadMarket();
              }}
            />
          )}
          {toMarket && (
            <PublishToMarketDialog target={toMarket} open onOpenChange={(o) => !o && setToMarket(null)} />
          )}
          {trust && (
            <TrustDialog
              target={trust}
              mode="approve"
              open
              onOpenChange={(o) => !o && setTrust(null)}
              onApproved={() => {
                setTrust(null);
                reload();
              }}
            />
          )}
        </Tabs>
      </div>
      <UsagesSheet row={usages} onClose={() => setUsages(null)} onOpenPage={openPage} />
    </TooltipProvider>
  );
}
