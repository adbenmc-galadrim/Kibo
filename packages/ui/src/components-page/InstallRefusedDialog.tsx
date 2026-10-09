import type { MarketPackageDetail } from "@kibo/schema";
import { Alert, AlertDescription, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { ShieldAlert } from "lucide-react";
import { KeyComparison, type KeyLine } from "../dialogs/KeyComparison";
import { frMarket } from "../i18n/fr-market";
import { shortKeyPrint } from "../lib/fingerprint";

export const REFUSAL_CODES = [
  "SIGNATURE_INVALID",
  "HASH_MISMATCH",
  "REVOKED",
  "PUBLISHER_CHANGED",
  "VALIDATION_FAILED",
] as const;
export type RefusalCode = (typeof REFUSAL_CODES)[number];

export const refusalOf = (code: string | null): RefusalCode | null =>
  REFUSAL_CODES.find((c) => c === code) ?? null;

const KEY_CODES: ReadonlySet<RefusalCode> = new Set(["SIGNATURE_INVALID", "PUBLISHER_CHANGED"]);

function description(code: RefusalCode, detail: MarketPackageDetail): string {
  const t = frMarket.market.refused;
  if (code === "SIGNATURE_INVALID") return t.signature(detail.sourceName);
  const reason = detail.versions.find((v) => v.version === detail.version)?.revoked;
  if (code === "REVOKED" && reason) return t.revoked(reason);
  return t.nothingInstalled;
}

function keyLines(detail: MarketPackageDetail): KeyLine[] {
  const t = frMarket.market;
  const listed = detail.publisher.publicKey;
  const expected = detail.pinnedPublisher ?? listed;
  const nameOf = (key: string) => (key === listed ? detail.publisher.name : null);
  const lines: KeyLine[] = [{ label: t.expectedKey, publicKey: expected, name: nameOf(expected) }];
  if (expected !== listed)
    lines.push({ label: t.receivedKey, publicKey: listed, name: nameOf(listed), mismatch: true });
  return lines;
}

type Props = {
  code: RefusalCode | null;
  detail: MarketPackageDetail;
  onClose(): void;
  onUnlock?(detail: MarketPackageDetail): void;
};

export function InstallRefusedDialog({ code, detail, onClose, onUnlock }: Props) {
  const t = frMarket.market.refused;
  const keyIssue = code !== null && KEY_CODES.has(code);
  return (
    <Dialog open={code !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle(detail.title, detail.version, detail.id)}</DialogDescription>
        </DialogHeader>
        {code && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <ShieldAlert aria-hidden />
            <AlertTitle>{t.titles[code]}</AlertTitle>
            <AlertDescription>{description(code, detail)}</AlertDescription>
          </Alert>
        )}
        {keyIssue && <KeyComparison lines={keyLines(detail)} format={shortKeyPrint} />}
        {keyIssue && <p className="text-sm text-muted-foreground">{t.keyHint(detail.publisher.name)}</p>}
        <DialogFooter>
          {keyIssue && onUnlock && (
            <Button variant="ghost" onClick={() => onUnlock(detail)}>
              {frMarket.market.unlock}
            </Button>
          )}
          <Button onClick={onClose}>{t.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
