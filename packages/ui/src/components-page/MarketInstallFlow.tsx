import type { MarketInstallResult, MarketPackageDetail } from "@kibo/schema";
import { useState } from "react";
import { PublisherChangedDialog } from "../dialogs/PublisherChangedDialog";
import { MarketPackageSheet, type MarketTarget } from "./MarketPackageSheet";

type Props = {
  target: MarketTarget | null;
  onTarget(target: MarketTarget | null): void;
  onInstalled(result: MarketInstallResult): void;
  remote?: boolean;
};

export function MarketInstallFlow({ target, onTarget, onInstalled, remote }: Props) {
  const [unlocking, setUnlocking] = useState<MarketPackageDetail | null>(null);
  return (
    <>
      <MarketPackageSheet
        target={target}
        onClose={() => onTarget(null)}
        onInstalled={(r) => {
          onTarget(null);
          onInstalled(r);
        }}
        onUnlock={setUnlocking}
        {...(remote !== undefined && { remote })}
      />
      {unlocking && (
        <PublisherChangedDialog
          detail={unlocking}
          open
          onOpenChange={(o) => !o && setUnlocking(null)}
          onUnlocked={() => {
            setUnlocking(null);
            if (target) onTarget({ ...target });
          }}
        />
      )}
    </>
  );
}
