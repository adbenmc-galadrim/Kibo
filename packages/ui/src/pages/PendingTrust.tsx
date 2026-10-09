import type { ComponentVersionSummary } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { frMarket } from "../i18n/fr-market";
import { trustTargetOf } from "../lib/trust-target";
import { TrustDialog } from "../shell/lazy-dialogs";
import { OtherVersionMenu } from "./OtherVersionMenu";

type Props = {
  id: string;
  title: string;
  version: string;
  summary: ComponentVersionSummary | null;
  tampered: boolean;
  compact: boolean;
  projectId: string;
  instanceId: string;
  others: string[];
};

export function PendingTrust({ id, title, version, summary, tampered, compact, ...change }: Props) {
  const i = fr.instance;
  const [open, setOpen] = useState(false);
  const target = summary ? trustTargetOf(id, title, summary) : null;
  return (
    <div
      data-tampered={tampered || undefined}
      className={`grid h-full place-items-center text-center ${compact ? "p-4" : "p-10"}`}
    >
      <div className="grid max-w-sm justify-items-center gap-2">
        <ShieldAlert aria-hidden className="size-6 text-orange-600 dark:text-orange-400" />
        <p className="font-medium">{i.pendingTitle}</p>
        <p className="text-sm text-muted-foreground">{i.pendingHelp(title, version)}</p>
        {tampered && <p className="text-sm text-muted-foreground">{i.pendingChanged}</p>}
        {summary?.revoked && (
          <p className="text-sm text-destructive">{frMarket.market.authRevoked(summary.revoked.reason)}</p>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={tampered || !target || Boolean(summary?.revoked)}
          onClick={() => setOpen(true)}
        >
          <ShieldCheck aria-hidden />
          {i.review}
        </Button>
        <OtherVersionMenu
          projectId={change.projectId}
          instanceId={change.instanceId}
          versions={change.others}
        />
      </div>
      {open && target && (
        <TrustDialog
          target={target}
          mode="approve"
          open
          onOpenChange={setOpen}
          onApproved={() => setOpen(false)}
        />
      )}
    </div>
  );
}
