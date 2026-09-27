import { Button } from "@kibo/sdk/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import type { ModifyTarget } from "../ai/ModifyWithAiDialog";
import { fr } from "../i18n/fr";
import type { FlashTone } from "../lib/use-flash";
import { ComponentRowMenu } from "./ComponentRowMenu";
import type { ComponentRow } from "./rows";
import { RevokedReason, UpdateButton, VersionCell } from "./VersionCell";

const ORANGE = "text-orange-600 dark:text-orange-400";
const HEAD = "h-9 px-4 text-2xs font-normal text-muted-foreground";
const CELL = "px-4 py-3";

function TrustCell({ row, onReview }: { row: ComponentRow; onReview(): void }) {
  const c = fr.components;
  if (row.trust === "pending")
    return (
      <span className="flex items-center gap-2">
        <span className={ORANGE}>{c.trust.pending}</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          onClick={onReview}
          disabled={row.tampered || row.revoked !== null}
        >
          {c.review}
        </Button>
      </span>
    );
  return (
    <span className={row.trust === "sandboxed" ? ORANGE : "text-muted-foreground"}>{c.trust[row.trust]}</span>
  );
}

const originText = (row: ComponentRow) =>
  row.market ? fr.market.originMarket(row.market.sourceName) : fr.components.origin[row.origin];

export type ComponentsTableProps = {
  rows: ComponentRow[];
  onReview(row: ComponentRow): void;
  onUpdate(row: ComponentRow, to: string): void;
  onDone(m: string, t: FlashTone): void;
  onModifyWithAi(target: ModifyTarget): void;
  onPublishToMarket(row: ComponentRow): void;
};

export function ComponentsTable({ rows, onReview, onUpdate, ...menu }: ComponentsTableProps) {
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
            <TableCell className={`${CELL} font-medium`}>
              {row.title}
              <RevokedReason row={row} />
            </TableCell>
            <TableCell className={CELL}>
              <VersionCell row={row} />
            </TableCell>
            <TableCell className={CELL}>
              <TrustCell row={row} onReview={() => onReview(row)} />
            </TableCell>
            <TableCell className={`${CELL} text-muted-foreground`}>{originText(row)}</TableCell>
            <TableCell className={`${CELL} text-muted-foreground`}>
              {c.usage(row.pages, row.projects)}
            </TableCell>
            <TableCell className={`${CELL} py-1.5 text-right`}>
              <span className="flex items-center justify-end gap-2">
                <UpdateButton row={row} onUpdate={(to) => onUpdate(row, to)} />
                <ComponentRowMenu row={row} {...menu} />
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
