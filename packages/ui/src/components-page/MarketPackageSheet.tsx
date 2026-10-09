import type { MarketInstallResult, MarketPackageDetail } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Alert, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Code, Download, Package, ShieldCheck } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { client } from "../api";
import { PermissionList } from "../dialogs/TrustDialog";
import { frMarket } from "../i18n/fr-market";
import { marketErrorCode, marketErrorText } from "../lib/market-errors";
import { isRemoteView } from "../lib/remote-view";
import { InstallRefusedDialog, type RefusalCode, refusalOf } from "./InstallRefusedDialog";
import { PackageFacts, VersionList } from "./PackageFacts";
import { SourceCode } from "./SourceCode";

export type MarketTarget = { sourceId: string; id: string; version: string };
type Props = {
  target: MarketTarget | null;
  onClose(): void;
  onInstalled(result: MarketInstallResult): void;
  onUnlock?(detail: MarketPackageDetail): void;
  remote?: boolean;
};

function usePackage(target: MarketTarget | null) {
  const [detail, setDetail] = useState<MarketPackageDetail | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDetail(null);
    setError(null);
    if (!target) return;
    let live = true;
    client
      .rpc({ method: "getMarketPackage", ...target })
      .then((d) => live && setDetail(d))
      .catch((e: unknown) => live && setError(marketErrorText(e)));
    client
      .rpc({ method: "listMarketSources" })
      .then((all) => live && setSourceUrl(all.find((s) => s.id === target.sourceId)?.url ?? null))
      .catch((e: unknown) => console.error("[kibo-ui] market sources failed", e));
    return () => {
      live = false;
    };
  }, [target]);
  return { detail, sourceUrl, error, setError };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Notice({ text, onUnlock }: { text: string; onUnlock?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm">
      <span className="text-destructive">{text}</span>
      {onUnlock && (
        <Button size="sm" variant="outline" onClick={onUnlock}>
          {frMarket.market.unlock}
        </Button>
      )}
    </div>
  );
}

type BodyProps = { detail: MarketPackageDetail; sourceUrl: string | null; showCode: boolean };

function PackageBody({ detail, sourceUrl, showCode }: BodyProps) {
  const t = frMarket.market;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{detail.description}</p>
      <PackageFacts detail={detail} sourceUrl={sourceUrl} />
      <Alert
        role="status"
        className="border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400"
      >
        <ShieldCheck aria-hidden />
        <AlertTitle>{t.codeVerified}</AlertTitle>
      </Alert>
      {showCode && <SourceCode files={detail.files} />}
      <Section title={t.permissions}>
        <PermissionList permissions={detail.permissions} framed={false} />
      </Section>
      <Section title={t.versions}>
        <VersionList detail={detail} />
      </Section>
    </div>
  );
}

export function MarketPackageSheet({
  target,
  onClose,
  onInstalled,
  onUnlock,
  remote = isRemoteView(),
}: Props) {
  const t = frMarket.market;
  const { detail, sourceUrl, error, setError } = usePackage(target);
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);

  const [shownTarget, setShownTarget] = useState(target);
  if (shownTarget !== target) {
    setShownTarget(target);
    setShowCode(false);
    setRefusal(null);
  }

  const install = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      onInstalled(await client.rpc({ method: "installFromMarket", ...target }));
    } catch (e) {
      const code = refusalOf(marketErrorCode(e));
      if (code) setRefusal(code);
      else setError(marketErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const version = detail?.version ?? target?.version ?? "";
  const blocked = busy || remote || !detail || detail.publisherChanged;
  return (
    <Sheet open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className={cn("w-full gap-0 sm:max-w-[30rem]", showCode && "sm:max-w-3xl")}>
        <SheetHeader className="gap-1 p-5 pb-3">
          <SheetTitle className="flex items-center gap-2 pr-6 text-lg">
            <Package aria-hidden className="size-4.5 shrink-0" />
            {detail?.title ?? target?.id}
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {t.idVersion(target?.id ?? "", version)}
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-5 pb-4">
          {detail?.publisherChanged && (
            <Notice text={t.errors.PUBLISHER_CHANGED} onUnlock={onUnlock && (() => onUnlock(detail))} />
          )}
          {detail && <PackageBody detail={detail} sourceUrl={sourceUrl} showCode={showCode} />}
          {remote && <p className="text-xs text-muted-foreground">{t.errors.FORBIDDEN}</p>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 border-t p-5">
          <Button variant="outline" disabled={!detail} onClick={() => setShowCode((s) => !s)}>
            <Code aria-hidden />
            {showCode ? t.hideCode : t.viewCode}
          </Button>
          <Button className="ml-auto" onClick={() => void install()} disabled={blocked}>
            <Download aria-hidden />
            {busy ? t.installing : t.install(version)}
          </Button>
        </div>
        {detail && (
          <InstallRefusedDialog
            code={refusal}
            detail={detail}
            onClose={() => setRefusal(null)}
            onUnlock={onUnlock}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
