import { type MarketInstallResult, type MarketPackageDetail, splitRef } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Download, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../api";
import { MarketPackageSheet, type MarketTarget } from "../components-page/MarketPackageSheet";
import { PublisherChangedDialog } from "../dialogs/PublisherChangedDialog";
import { TrustDialog, trustTargetOfInstall } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";
import { marketErrorText } from "../lib/market-errors";
import { useProject } from "../state/use-projects";

type Props = { projectId: string; componentRef: string; hash: string | null; compact: boolean };
type Offer = { sourceId: string; sourceName: string };

function useOffer(id: string, version: string, hash: string | null, fail: (text: string) => void) {
  const [offer, setOffer] = useState<Offer | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const find = async (): Promise<Offer | null> => {
      const found = await client.rpc({ method: "findMarketSource", id, version, hash });
      if (!found) return null;
      const sources = await client.rpc({ method: "listMarketSources" });
      const name = sources.find((s) => s.id === found.sourceId)?.name ?? found.sourceId;
      return { sourceId: found.sourceId, sourceName: name };
    };
    find().then(
      (o) => live && setOffer(o),
      (e: unknown) => live && fail(marketErrorText(e)),
    );
    return () => {
      live = false;
    };
  }, [id, version, hash, fail]);
  return offer;
}

export function MissingComponent({ projectId, componentRef, hash, compact }: Props) {
  const t = fr.market;
  const { id, version } = splitRef(componentRef);
  const owner = useProject(projectId)?.sync.members.find((m) => m.role === "owner") ?? null;
  const [error, setError] = useState<string | null>(null);
  const [fail] = useState(() => (text: string) => setError(text));
  const offer = useOffer(id, version, hash, fail);
  const [target, setTarget] = useState<MarketTarget | null>(null);
  const [unlocking, setUnlocking] = useState<MarketPackageDetail | null>(null);
  const [installed, setInstalled] = useState<MarketInstallResult | null>(null);

  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed text-center text-sm ${compact ? "p-4" : "p-10"}`}
    >
      <Package className="size-5 text-muted-foreground" aria-hidden />
      <p className="font-medium">{t.missing(componentRef)}</p>
      {offer && <p className="text-xs text-muted-foreground">{t.missingOffered(offer.sourceName)}</p>}
      {offer && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setTarget({ sourceId: offer.sourceId, id, version })}
        >
          <Download aria-hidden />
          {t.installMissing}
        </Button>
      )}
      {offer === null && owner && <p className="text-xs text-muted-foreground">{t.askOwner(owner.name)}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <MarketPackageSheet
        target={target}
        onClose={() => setTarget(null)}
        onInstalled={(r) => {
          setTarget(null);
          setInstalled(r);
        }}
        onUnlock={setUnlocking}
      />
      {unlocking && (
        <PublisherChangedDialog
          detail={unlocking}
          open
          onOpenChange={(o) => !o && setUnlocking(null)}
          onUnlocked={() => {
            setUnlocking(null);
            setTarget((current) => (current ? { ...current } : current));
          }}
        />
      )}
      {installed && (
        <TrustDialog
          target={trustTargetOfInstall(installed)}
          mode="approve"
          open
          onOpenChange={(o) => !o && setInstalled(null)}
          onApproved={() => setInstalled(null)}
        />
      )}
    </div>
  );
}
