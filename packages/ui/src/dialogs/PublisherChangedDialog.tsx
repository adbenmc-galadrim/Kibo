import type { MarketPackageDetail } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { groupFingerprint } from "../lib/fingerprint";
import { marketErrorText } from "../lib/market-errors";
import { isRemoteView } from "../lib/remote-view";
import { KeyComparison, type KeyLine } from "./KeyComparison";

type Detail = Pick<MarketPackageDetail, "sourceId" | "id" | "pinnedPublisher" | "publisher">;
type Props = {
  detail: Detail;
  open: boolean;
  onOpenChange(open: boolean): void;
  onUnlocked(): void;
  remote?: boolean;
};

function keyLines(detail: Detail): KeyLine[] {
  const t = fr.market;
  const next = {
    label: t.newKey,
    publicKey: detail.publisher.publicKey,
    name: detail.publisher.name,
    mismatch: true,
  };
  return detail.pinnedPublisher ? [{ label: t.oldKey, publicKey: detail.pinnedPublisher }, next] : [next];
}

export function PublisherChangedDialog({
  detail,
  open,
  onOpenChange,
  onUnlocked,
  remote = isRemoteView(),
}: Props) {
  const t = fr.market;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.rpc({ method: "unpinPublisher", sourceId: detail.sourceId, componentId: detail.id });
      onUnlocked();
    } catch (e) {
      setError(marketErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.changedTitle}</DialogTitle>
          <DialogDescription>{t.changedHelp}</DialogDescription>
        </DialogHeader>
        <KeyComparison lines={keyLines(detail)} format={groupFingerprint} />
        {remote && <p className="text-sm text-muted-foreground">{t.errors.FORBIDDEN}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button variant="destructive" disabled={busy || remote} onClick={() => void unlock()}>
            {t.unlockConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
