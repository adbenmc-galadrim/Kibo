import { Button } from "@kibo/sdk/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { TooltipProvider } from "@kibo/sdk/ui/tooltip";
import { useState } from "react";
import { TrustDialog, type TrustTarget, trustTargetOf } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";
import { type FlashTone, useFlash } from "../lib/use-flash";
import { useComponents } from "../state/use-components";
import { ComponentRowMenu } from "./ComponentRowMenu";
import { DraftsSection } from "./DraftsSection";
import { PublishDialog } from "./PublishDialog";
import { type ComponentRow, componentRows } from "./rows";

const ORANGE = "text-orange-600 dark:text-orange-400";
const HEAD = "h-9 px-4 text-2xs font-normal text-muted-foreground";
const CELL = "px-4 py-3";

function TrustCell({ row, onReview }: { row: ComponentRow; onReview(): void }) {
  const c = fr.components;
  if (row.trust === "pending")
    return (
      <span className="flex items-center gap-2">
        <span className={ORANGE}>{c.trust.pending}</span>
        <Button size="sm" variant="outline" className="h-7" onClick={onReview} disabled={row.tampered}>
          {c.review}
        </Button>
      </span>
    );
  return (
    <span className={row.trust === "sandboxed" ? ORANGE : "text-muted-foreground"}>{c.trust[row.trust]}</span>
  );
}

type TableProps = {
  rows: ComponentRow[];
  onReview(row: ComponentRow): void;
  onDone(m: string, t: FlashTone): void;
};

function ComponentsTable({ rows, onReview, onDone }: TableProps) {
  const c = fr.components;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>{c.column.name}</TableHead>
          <TableHead className={HEAD}>{c.column.version}</TableHead>
          <TableHead className={HEAD}>{c.column.trust}</TableHead>
          <TableHead className={HEAD}>{c.column.origin}</TableHead>
          <TableHead className={HEAD}>{c.column.usedIn}</TableHead>
          <TableHead className={`${HEAD} w-12`} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className={`${CELL} font-medium`}>{row.title}</TableCell>
            <TableCell className={`${CELL} font-mono text-xs text-muted-foreground`}>{row.version}</TableCell>
            <TableCell className={CELL}>
              <TrustCell row={row} onReview={() => onReview(row)} />
            </TableCell>
            <TableCell className={`${CELL} text-muted-foreground`}>{c.origin[row.origin]}</TableCell>
            <TableCell className={`${CELL} text-muted-foreground`}>
              {c.usage(row.pages, row.projects)}
            </TableCell>
            <TableCell className={`${CELL} py-1.5 text-right`}>
              <ComponentRowMenu row={row} onDone={onDone} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ComponentsPage() {
  const c = fr.components;
  const { components, drafts, error, reload } = useComponents();
  const { message, tone, flash } = useFlash();
  const [publishing, setPublishing] = useState<string | null>(null);
  const [trust, setTrust] = useState<TrustTarget | null>(null);
  const rows = components ? componentRows(components) : null;

  const review = (row: ComponentRow) => {
    const target = row.summary ? trustTargetOf(row.id, row.title, row.summary) : null;
    if (target) setTrust(target);
  };
  const done = (m: string, t: FlashTone) => {
    flash(m, t);
    reload();
  };

  return (
    <TooltipProvider>
      <div className="grid content-start gap-6 p-6">
        <div className="overflow-hidden rounded-lg border bg-card">
          <ComponentsTable rows={rows ?? []} onReview={review} onDone={done} />
          {rows === null && !error && <p className="px-4 py-3 text-sm text-muted-foreground">{c.loading}</p>}
        </div>
        {rows?.every((r) => r.builtin) && <p className="text-sm text-muted-foreground">{c.empty}</p>}
        {message && (
          <p
            role={tone === "error" ? "alert" : "status"}
            className={`text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {c.failed}
          </p>
        )}
        <DraftsSection drafts={drafts ?? []} onPublish={setPublishing} />
        {publishing && (
          <PublishDialog
            id={publishing}
            open
            onOpenChange={(o) => !o && setPublishing(null)}
            onPublished={reload}
          />
        )}
        {trust && (
          <TrustDialog
            target={trust}
            mode="approve"
            open
            onOpenChange={(o) => !o && setTrust(null)}
            onApproved={() => {
              setTrust(null);
              reload();
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
