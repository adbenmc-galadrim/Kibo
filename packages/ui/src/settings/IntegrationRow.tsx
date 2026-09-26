import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { fr } from "../i18n/fr";
import type { RowMenuItem, RowView } from "./integration-rows";

const DOT = { ok: "bg-green-500", warn: "bg-amber-500", error: "bg-red-500" } as const;

type Props = { row: RowView; onAction(action: "connect" | "retry"): void; onMenu(item: RowMenuItem): void };

function RowMenu({ row, onMenu }: Pick<Props, "row" | "onMenu">) {
  const t = fr.integrations.menu;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={t.label(row.title)}>
          <MoreHorizontal aria-hidden className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {row.menu.includes("configure") && (
          <DropdownMenuItem onSelect={() => onMenu("configure")}>{t.configure}</DropdownMenuItem>
        )}
        {row.menu.includes("test") && (
          <DropdownMenuItem onSelect={() => onMenu("test")}>{t.test}</DropdownMenuItem>
        )}
        {row.menu.includes("disconnect") && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onMenu("disconnect")}>
              {t.disconnect}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function IntegrationRow({ row, onAction, onMenu }: Props) {
  const t = fr.integrations.state;
  const Icon = row.icon;
  const action = row.action;
  return (
    <li className="flex min-h-16 items-center gap-4 rounded-lg border bg-card px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
        <Icon aria-hidden className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-sm font-medium">{row.title}</p>
        <p
          className={cn(
            "truncate text-xs",
            row.error ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
          )}
        >
          {row.error ?? row.description}
        </p>
      </div>
      {row.badge && (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className={cn("size-1.5 rounded-full", DOT[row.badge.tone])} />
          {row.badge.label}
        </span>
      )}
      {action && (
        <Button variant="outline" size="sm" onClick={() => onAction(action)}>
          {action === "connect" ? t.connect : t.retry}
        </Button>
      )}
      {row.menu.length > 0 && <RowMenu row={row} onMenu={onMenu} />}
    </li>
  );
}
