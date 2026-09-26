import {
  type ApprovableTrust,
  type ComponentOrigin,
  type ComponentVersionSummary,
  type GrantedPermissions,
  grantedOf,
  KiboError,
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
import { useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { permissionLines } from "../lib/permission-lines";

export type TrustTarget = {
  id: string;
  title: string;
  version: string;
  hash: string;
  origin: ComponentOrigin;
  permissions: GrantedPermissions;
};

export function trustTargetOf(id: string, title: string, v: ComponentVersionSummary): TrustTarget | null {
  if (!v.hash || !v.manifest) return null;
  return {
    id,
    title,
    version: v.version,
    hash: v.hash,
    origin: v.origin,
    permissions: grantedOf(v.manifest),
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
};

function LevelCard({ value, title, help }: { value: ApprovableTrust; title: string; help: string }) {
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
      </span>
    </label>
  );
}

function PermissionList({ permissions }: { permissions: GrantedPermissions }) {
  return (
    <ul className="grid gap-3 rounded-lg border p-4">
      {permissionLines(permissions).map((line) => (
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

export function TrustDialog({
  target,
  mode,
  open,
  onOpenChange,
  onApproved,
  approve: delegate,
  onCloseAutoFocus,
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
      setError(e instanceof KiboError && e.code === "HASH_MISMATCH" ? t.hashMismatch : t.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t.title(target.title, target.version)}</DialogTitle>
          <DialogDescription>{t.subtitle(t.origin[target.origin], shortHash(target.hash))}</DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium">{t.asks}</p>
        <PermissionList permissions={target.permissions} />
        <p className="text-sm font-medium">{t.level}</p>
        <RadioGroup
          value={level}
          onValueChange={(v) => setLevel(v === "trusted" ? "trusted" : "sandboxed")}
          className="grid gap-2"
        >
          <LevelCard value="sandboxed" title={t.sandboxed} help={t.sandboxedHelp} />
          <LevelCard value="trusted" title={t.trusted} help={t.trustedHelp} />
        </RadioGroup>
        <p className="text-xs text-muted-foreground">{t.footer}</p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.refuse}
          </Button>
          <Button disabled={busy} onClick={() => void approve()}>
            {mode === "approveAndAdd" ? t.approveAndAdd : t.approve}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
