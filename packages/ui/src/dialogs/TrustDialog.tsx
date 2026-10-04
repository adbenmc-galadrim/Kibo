import {
  type ApprovableTrust,
  type GrantedPermissions,
  KiboError,
  type MarketInstallResult,
  type RegistryVersion,
  shortHash,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { permissionLines } from "../lib/permission-lines";
import { isRemoteView } from "../lib/remote-view";
import type { TrustTarget } from "../lib/trust-target";
import { MarketSubtitle } from "./MarketSubtitle";

export function trustTargetOfInstall(r: MarketInstallResult): TrustTarget {
  return {
    id: r.id,
    title: r.title,
    version: r.version,
    hash: r.hash,
    origin: "marketplace",
    permissions: r.permissions,
    market: r.market,
  };
}

type Props = {
  target: TrustTarget;
  mode: "approve" | "approveAndAdd";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApproved: (v: RegistryVersion) => void;
  approve?: (trust: ApprovableTrust) => Promise<RegistryVersion>;
  onCloseAutoFocus?: (event: Event) => void;
  remote?: boolean;
};

type LevelProps = { value: ApprovableTrust; title: string; help: string; warning?: string | null };

function LevelCard({ value, title, help, warning }: LevelProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-foreground/70"
    >
      <RadioGroupItem id={id} value={value} aria-label={title} className="mt-0.5" />
      <span className="grid gap-1">
        <span className="text-sm font-medium leading-none">{title}</span>
        <span className="text-xs text-muted-foreground">{help}</span>
        {warning && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            {warning}
          </span>
        )}
      </span>
    </label>
  );
}

export function PermissionList({
  permissions,
  selection = false,
  framed = true,
}: {
  permissions: GrantedPermissions;
  selection?: boolean;
  framed?: boolean;
}) {
  return (
    <ul className={framed ? "grid gap-3 rounded-lg border p-4" : "grid gap-3"}>
      {permissionLines(permissions, { selection }).map((line) => (
        <li key={line.title} className="flex items-start gap-3">
          <line.icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="grid gap-0.5">
            <span className="text-sm">{line.title}</span>
            {line.detail && <span className="text-xs text-muted-foreground">{line.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function failureOf(e: unknown): string {
  if (!(e instanceof KiboError)) return fr.trust.failed;
  if (e.code === "HASH_MISMATCH") return fr.trust.hashMismatch;
  if (e.code === "FORBIDDEN") return fr.componentErrors.FORBIDDEN;
  return fr.trust.failed;
}

export function TrustDialog({
  target,
  mode,
  open,
  onOpenChange,
  onApproved,
  approve: delegate,
  onCloseAutoFocus,
  remote = isRemoteView(),
}: Props) {
  const t = fr.trust;
  const [level, setLevel] = useState<ApprovableTrust>("sandboxed");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const v = delegate
        ? await delegate(level)
        : await client.rpc({
            method: "approveComponent",
            id: target.id,
            version: target.version,
            hash: target.hash,
            trust: level,
          });
      onApproved(v);
      onOpenChange(false);
    } catch (e) {
      if (!(e instanceof KiboError)) console.error(e);
      setError(failureOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t.title(target.title, target.version)}</DialogTitle>
          <DialogDescription asChild={Boolean(target.market)}>
            {target.market ? (
              <MarketSubtitle market={target.market} />
            ) : (
              t.subtitle(t.origin[target.origin], shortHash(target.hash))
            )}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium">{t.asks}</p>
        <PermissionList permissions={target.permissions} selection={target.selection ?? false} />
        <p className="text-sm font-medium">{t.level}</p>
        <RadioGroup
          value={level}
          onValueChange={(v) => setLevel(v === "trusted" ? "trusted" : "sandboxed")}
          className="grid gap-2"
        >
          <LevelCard value="sandboxed" title={t.sandboxed} help={t.sandboxedHelp} />
          <LevelCard
            value="trusted"
            title={t.trusted}
            help={t.trustedHelp}
            warning={target.market ? fr.market.fromMarketplace : null}
          />
        </RadioGroup>
        <p className="text-xs text-muted-foreground">{t.footer}</p>
        {remote && <p className="text-sm text-muted-foreground">{fr.componentErrors.FORBIDDEN}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.refuse}
          </Button>
          <Button disabled={busy || remote} onClick={() => void approve()}>
            {mode === "approveAndAdd" ? t.approveAndAdd : t.approve}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
