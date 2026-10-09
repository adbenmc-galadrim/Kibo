import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { Ellipsis, ScanSearch, ShieldOff, Sparkles, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import type { ModifyTarget } from "../ai/ModifyWithAiDialog";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frMarket } from "../i18n/fr-market";
import { marketErrorText } from "../lib/market-errors";
import type { FlashTone } from "../lib/use-flash";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { type ComponentRow, modifiable } from "./rows";

type Props = {
  row: ComponentRow;
  onDone(message: string, tone: FlashTone): void;
  onModifyWithAi(target: ModifyTarget): void;
  onPublishToMarket(row: ComponentRow): void;
};

type Confirming = "revoke" | "uninstall";

const rehashChanged = (e: unknown): string | null =>
  e instanceof KiboError && e.code === "TRUST_REQUIRED" ? fr.components.rehashChanged : null;

const uninstallError = (e: unknown): string =>
  e instanceof KiboError && e.code === "INVALID_INPUT" ? fr.components.uninstallBlocked : marketErrorText(e);

function BlockedUninstall() {
  const c = fr.components;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block">
          <DropdownMenuItem disabled variant="destructive">
            <Trash2 aria-hidden />
            {c.uninstall}
          </DropdownMenuItem>
        </span>
      </TooltipTrigger>
      <TooltipContent>{c.uninstallBlocked}</TooltipContent>
    </Tooltip>
  );
}

export const publishable = (row: ComponentRow): boolean =>
  modifiable(row.origin) && row.trust !== "pending" && Boolean(row.summary?.hash && row.summary.manifest);

function ConfirmAction({
  row,
  kind,
  onClose,
  onDone,
}: Pick<Props, "row" | "onDone"> & {
  kind: Confirming;
  onClose(): void;
}) {
  const c = fr.components;
  const ref = { id: row.id, version: row.version };
  const revoke = kind === "revoke";
  const confirm = async () => {
    await client.rpc(
      revoke ? { method: "revokeComponent", ...ref } : { method: "uninstallComponent", ...ref },
    );
    onDone(revoke ? c.revokeOk : c.uninstallOk, "ok");
  };
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={revoke ? c.revokeTitle(row.title, row.version) : c.uninstallTitle(row.title, row.version)}
      description={revoke ? c.revokeHelp : c.uninstallHelp}
      confirmLabel={revoke ? c.revokeConfirm : c.uninstallConfirm}
      cancelLabel={c.cancel}
      onConfirm={confirm}
      describeError={revoke ? marketErrorText : uninstallError}
    />
  );
}

export function ComponentRowMenu({ row, onDone, onModifyWithAi, onPublishToMarket }: Props) {
  const c = fr.components;
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const ref = { id: row.id, version: row.version };
  const origin = row.origin;
  const rehash = async () => {
    try {
      await client.rpc({ method: "rehashComponent", ...ref });
      onDone(c.rehashOk, "ok");
    } catch (e) {
      const known = rehashChanged(e);
      if (known === null) console.error(e);
      onDone(known ?? c.actionFailed, "error");
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={c.actions(row.title, row.version)}
          >
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void rehash()}>
            <ScanSearch aria-hidden />
            {c.rehash}
          </DropdownMenuItem>
          {row.trust !== "pending" && (
            <DropdownMenuItem onSelect={() => setConfirming("revoke")}>
              <ShieldOff aria-hidden />
              {c.revoke}
            </DropdownMenuItem>
          )}
          {modifiable(origin) && (
            <DropdownMenuItem onSelect={() => onModifyWithAi({ ...ref, title: row.title, origin })}>
              <Sparkles aria-hidden />
              {fr.ai.modify}
            </DropdownMenuItem>
          )}
          {publishable(row) && (
            <DropdownMenuItem onSelect={() => onPublishToMarket(row)}>
              <Upload aria-hidden />
              {frMarket.market.publish}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {row.used ? (
            <BlockedUninstall />
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirming("uninstall")}>
              <Trash2 aria-hidden />
              {c.uninstall}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming && (
        <ConfirmAction row={row} kind={confirming} onClose={() => setConfirming(null)} onDone={onDone} />
      )}
    </>
  );
}
