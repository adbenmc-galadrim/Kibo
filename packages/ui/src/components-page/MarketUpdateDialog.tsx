import type { ComponentVersionSummary, MarketInstallResult, MarketPackageDetail } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { useEffect, useState } from "react";
import { client } from "../api";
import { PublisherChangedDialog } from "../dialogs/PublisherChangedDialog";
import { TrustDialog, trustTargetOfInstall } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";
import { marketErrorText } from "../lib/market-errors";
import { buildUpdateSummary } from "../lib/market-update";
import { isRemoteView } from "../lib/remote-view";
import { useProjects } from "../state/use-projects";
import { ChangesList, NEUTRAL_DOT, type Strategy, StrategyChoice, UsagesBox } from "./PublishSections";

type Props = {
  title: string;
  summary: ComponentVersionSummary;
  sourceId: string;
  componentId: string;
  to: string;
  onDone(): void;
  remote?: boolean;
};

function usePackageDetail(sourceId: string, id: string, to: string, fail: (text: string) => void) {
  const [detail, setDetail] = useState<MarketPackageDetail | null>(null);
  useEffect(() => {
    let live = true;
    client.rpc({ method: "getMarketPackage", sourceId, id, version: to }).then(
      (d) => live && setDetail(d),
      (e: unknown) => live && fail(marketErrorText(e)),
    );
    return () => {
      live = false;
    };
  }, [sourceId, id, to, fail]);
  return detail;
}

export function MarketUpdateDialog({
  title,
  summary,
  sourceId,
  componentId: id,
  to,
  onDone,
  remote = isRemoteView(),
}: Props) {
  const t = fr.market;
  const projects = useProjects().projects ?? [];
  const [error, setError] = useState<string | null>(null);
  const [fail] = useState(() => (text: string) => setError(text));
  const detail = usePackageDetail(sourceId, id, to, fail);
  const [strategy, setStrategy] = useState<Strategy>("update-all");
  const [installed, setInstalled] = useState<MarketInstallResult | null>(null);
  const [busy, setBusy] = useState(false);
  const colorOf = (projectId: string) => projects.find((p) => p.id === projectId)?.color ?? NEUTRAL_DOT;

  const install = async () => {
    setBusy(true);
    setError(null);
    try {
      setInstalled(await client.rpc({ method: "installFromMarket", sourceId, id, version: to }));
    } catch (e) {
      setError(marketErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    setInstalled(null);
    try {
      if (strategy === "update-all")
        for (const u of summary.usages)
          await client.rpc({
            method: "updateInstance",
            projectId: u.projectId,
            instanceId: u.instanceId,
            to,
          });
      onDone();
    } catch (e) {
      setError(marketErrorText(e));
    }
  };

  if (detail?.publisherChanged)
    return (
      <PublisherChangedDialog detail={detail} open onOpenChange={(o) => !o && onDone()} onUnlocked={onDone} />
    );
  if (installed)
    return (
      <TrustDialog
        target={trustTargetOfInstall(installed)}
        mode="approve"
        open
        onOpenChange={(o) => !o && onDone()}
        onApproved={() => void apply()}
      />
    );
  const update = detail ? buildUpdateSummary({ summary, detail }) : null;
  const used = (update?.usages.length ?? 0) > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.updateTitle(title, summary.version, to)}</DialogTitle>
        </DialogHeader>
        {update && (
          <>
            {used && <UsagesBox preview={update} strategy={strategy} colorOf={colorOf} />}
            <ChangesList preview={update} />
            {used && <StrategyChoice preview={update} value={strategy} onChange={setStrategy} />}
          </>
        )}
        {remote && <p className="text-sm text-muted-foreground">{t.errors.FORBIDDEN}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            {fr.common.cancel}
          </Button>
          <Button disabled={busy || remote || !update} onClick={() => void install()}>
            {busy ? t.updating : t.update}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
