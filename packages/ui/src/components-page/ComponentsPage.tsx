import { grantedOf } from "@kibo/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kibo/sdk/ui/tabs";
import { TooltipProvider } from "@kibo/sdk/ui/tooltip";
import { useState } from "react";
import type { ModifyTarget } from "../ai/ModifyWithAiDialog";
import { TrustDialog, trustTargetOfInstall } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";
import { type TrustTarget, trustTargetOf } from "../lib/trust-target";
import { type FlashTone, useFlash } from "../lib/use-flash";
import { ModifyWithAiDialog } from "../shell/lazy-dialogs";
import { useComponents } from "../state/use-components";
import { useMarketStatus } from "../state/use-market-status";
import { ComponentsTable } from "./ComponentsTable";
import { DraftsSection } from "./DraftsSection";
import { MarketplaceTab } from "./MarketplaceTab";
import { MarketUpdateDialog } from "./MarketUpdateDialog";
import { PublishDialog } from "./PublishDialog";
import { type PublishTarget, PublishToMarketDialog } from "./PublishToMarketDialog";
import { type ComponentRow, componentRows } from "./rows";
import { SandboxBanner } from "./SandboxBanner";

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

export function ComponentsPage() {
  const c = fr.components;
  const { components, drafts, error, reload } = useComponents();
  const { message, tone, flash } = useFlash();
  const [publishing, setPublishing] = useState<string | null>(null);
  const [trust, setTrust] = useState<TrustTarget | null>(null);
  const [modifying, setModifying] = useState<ModifyTarget | null>(null);
  const [updating, setUpdating] = useState<Updating | null>(null);
  const [toMarket, setToMarket] = useState<PublishTarget | null>(null);
  const { statuses, reload: reloadMarket } = useMarketStatus();
  const rows = components ? componentRows(components, statuses) : null;

  const review = (row: ComponentRow) => {
    const target = row.summary ? trustTargetOf(row.id, row.title, row.summary) : null;
    if (target) setTrust(target);
  };
  const done = (m: string, t: FlashTone) => {
    flash(m, t);
    reload();
  };

  return (
    <TooltipProvider>
      <Tabs defaultValue="installed" className="gap-4 p-6">
        <TabsList className="h-auto gap-1 bg-transparent p-0">
          <TabsTrigger value="installed" className={TAB}>
            {fr.market.tabInstalled}
          </TabsTrigger>
          <TabsTrigger value="market" className={TAB}>
            {fr.market.tabMarket}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="installed" className="grid content-start gap-6">
          <SandboxBanner />
          <div className="overflow-hidden rounded-lg border bg-card">
            <ComponentsTable
              rows={rows ?? []}
              onReview={review}
              onUpdate={(row, to) => setUpdating({ row, to })}
              onDone={done}
              onModifyWithAi={setModifying}
              onPublishToMarket={(row) => setToMarket(publishTarget(row))}
            />
            {rows === null && !error && (
              <p className="px-4 py-3 text-sm text-muted-foreground">{c.loading}</p>
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
        {modifying && (
          <ModifyWithAiDialog
            component={modifying}
            open
            onOpenChange={(o) => {
              if (o) return;
              setModifying(null);
              reload();
            }}
          />
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
    </TooltipProvider>
  );
}
