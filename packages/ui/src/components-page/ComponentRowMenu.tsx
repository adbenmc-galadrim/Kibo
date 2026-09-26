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
import { Ellipsis, ScanSearch, ShieldOff, Trash2 } from "lucide-react";
import type { ComponentProps } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import type { FlashTone } from "../lib/use-flash";
import type { ComponentRow } from "./rows";

type Props = { row: ComponentRow; onDone(message: string, tone: FlashTone): void };

const rehashChanged = (e: unknown): string | null =>
  e instanceof KiboError && e.code === "TRUST_REQUIRED" ? fr.components.rehashChanged : null;

function MenuButton({ label, ...props }: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button size="icon" variant="ghost" className="size-7" aria-label={label} {...props}>
      <Ellipsis aria-hidden />
    </Button>
  );
}

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

export function ComponentRowMenu({ row, onDone }: Props) {
  const c = fr.components;
  const label = c.actions(row.title, row.version);
  if (row.builtin) return <MenuButton label={label} disabled />;
  const ref = { id: row.id, version: row.version };
  const run = async (work: () => Promise<unknown>, ok: string, explain?: (e: unknown) => string | null) => {
    try {
      await work();
      onDone(ok, "ok");
    } catch (e) {
      const known = explain?.(e) ?? null;
      if (known === null) console.error(e);
      onDone(known ?? c.actionFailed, "error");
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuButton label={label} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() =>
            void run(() => client.rpc({ method: "rehashComponent", ...ref }), c.rehashOk, rehashChanged)
          }
        >
          <ScanSearch aria-hidden />
          {c.rehash}
        </DropdownMenuItem>
        {row.trust !== "pending" && (
          <DropdownMenuItem
            onSelect={() => void run(() => client.rpc({ method: "revokeComponent", ...ref }), c.revoke)}
          >
            <ShieldOff aria-hidden />
            {c.revoke}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {row.used ? (
          <BlockedUninstall />
        ) : (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => void run(() => client.rpc({ method: "uninstallComponent", ...ref }), c.uninstall)}
          >
            <Trash2 aria-hidden />
            {c.uninstall}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
