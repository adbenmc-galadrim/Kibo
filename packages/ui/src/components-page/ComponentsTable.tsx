import { Button } from "@kibo/sdk/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ModifyTarget } from "../ai/ModifyWithAiDialog";
import { fr } from "../i18n/fr";
import { frComponentsList } from "../i18n/fr-components-list";
import type { FlashTone } from "../lib/use-flash";
import { ComponentRowMenu } from "./ComponentRowMenu";
import type { ComponentsQuery, SortKey } from "./filter-components";
import type { ComponentRow } from "./rows";
import { RevokedReason, UpdateButton, VersionCell } from "./VersionCell";

const ORANGE = "text-orange-600 dark:text-orange-400";
const HEAD = "h-9 px-4 text-2xs font-normal text-muted-foreground";
const SORT_BUTTON =
  "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
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
  if (row.trust === "sandboxed")
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`${ORANGE} cursor-help`}>{c.trust.sandboxed}</span>
        </TooltipTrigger>
        <TooltipContent>{c.sandboxedHelp}</TooltipContent>
      </Tooltip>
    );
  return <span className="text-muted-foreground">{c.trust[row.trust]}</span>;
}

const originText = (row: ComponentRow) =>
  row.market ? fr.market.originMarket(row.market.sourceName) : fr.components.origin[row.origin];

type SortHeadProps = { column: SortKey; label: string; query: ComponentsQuery; onSort(key: SortKey): void };

function SortHead({ column, label, query, onSort }: SortHeadProps) {
  const active = query.sort === column;
  const Arrow = !active ? ArrowUpDown : query.descending ? ArrowDown : ArrowUp;
  const sort = !active ? "none" : query.descending ? "descending" : "ascending";
  return (
    <TableHead className={HEAD} aria-sort={sort}>
      <button
        type="button"
        aria-label={frComponentsList.sortBy(label)}
        className={`${SORT_BUTTON} ${active ? "text-foreground" : ""}`}
        onClick={() => onSort(column)}
      >
        {label}
        <Arrow aria-hidden className={`size-3 ${active ? "" : "opacity-40"}`} />
      </button>
    </TableHead>
  );
}

function UsageCell({ row, onUsages }: { row: ComponentRow; onUsages(): void }) {
  const text = fr.components.usage(row.pages, row.projects);
  if (row.pages === 0) return <>{text}</>;
  return (
    <Button variant="link" className="h-auto p-0 font-normal text-muted-foreground" onClick={onUsages}>
      {text}
    </Button>
  );
}

const COLUMNS: { key: SortKey; label: keyof typeof fr.components.column }[] = [
  { key: "title", label: "name" },
  { key: "version", label: "version" },
  { key: "trust", label: "trust" },
  { key: "origin", label: "origin" },
  { key: "usage", label: "usedIn" },
];

export type ComponentsTableProps = {
  rows: ComponentRow[];
  query: ComponentsQuery;
  onSort(key: SortKey): void;
  onUsages(row: ComponentRow): void;
  onReview(row: ComponentRow): void;
  onUpdate(row: ComponentRow, to: string): void;
  onDone(m: string, t: FlashTone): void;
  onModifyWithAi(target: ModifyTarget): void;
  onPublishToMarket(row: ComponentRow): void;
};

export function ComponentsTable({
  rows,
  query,
  onSort,
  onUsages,
  onReview,
  onUpdate,
  ...menu
}: ComponentsTableProps) {
  const c = fr.components;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {COLUMNS.map((col) => (
            <SortHead
              key={col.key}
              column={col.key}
              label={c.column[col.label]}
              query={query}
              onSort={onSort}
            />
          ))}
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
              <UsageCell row={row} onUsages={() => onUsages(row)} />
            </TableCell>
            <TableCell className={`${CELL} py-1.5 text-right`}>
              <span className="flex items-center justify-end gap-2">
                <UpdateButton row={row} onUpdate={(to) => onUpdate(row, to)} />
                {!row.builtin && <ComponentRowMenu row={row} {...menu} />}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
