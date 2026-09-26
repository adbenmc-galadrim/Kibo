import type { ComponentVersionSummary } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { TrustDialog, trustTargetOf } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";

type Props = {
  id: string;
  title: string;
  version: string;
  summary: ComponentVersionSummary | null;
  tampered: boolean;
  compact: boolean;
};

export function PendingTrust({ id, title, version, summary, tampered, compact }: Props) {
  const i = fr.instance;
  const [open, setOpen] = useState(false);
  const target = summary ? trustTargetOf(id, title, summary) : null;
  return (
    <div className={`grid h-full place-items-center text-center ${compact ? "p-4" : "p-10"}`}>
      <div className="grid max-w-sm justify-items-center gap-2">
        <ShieldAlert aria-hidden className="size-6 text-orange-600 dark:text-orange-400" />
        <p className="font-medium">{i.pendingTitle}</p>
        <p className="text-sm text-muted-foreground">{i.pendingHelp(title, version)}</p>
        {tampered && <p className="text-sm text-muted-foreground">{i.pendingChanged}</p>}
        <Button size="sm" variant="outline" disabled={tampered || !target} onClick={() => setOpen(true)}>
          <ShieldCheck aria-hidden />
          {i.review}
        </Button>
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
