import { Copy, Maximize2 } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import type { Align, MdTable } from "./markdown-blocks";
import { type InlineContext, renderInline } from "./markdown-inline";

export type MarkdownTableLabels = {
  table: string;
  expand: string;
  expandTable: string;
  size(rows: number, columns: number): string;
  copy: string;
  copied: string;
  copyFailed: string;
};

type Props = { table: MdTable; labels: MarkdownTableLabels; ctx: InlineContext };

const ALIGN_CLASS: Record<Exclude<Align, null>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};
const CELL = "px-2.5 py-1.5 text-left align-top";

type Cell = { key: string; column: number; nodes: MdTable["head"][number] };

const cellsOf = (row: MdTable["head"], prefix: string): Cell[] =>
  row.map((nodes, column) => ({ key: `${prefix}c${column}`, column, nodes }));

function TableGrid({ table, ctx, wide }: { table: MdTable; ctx: InlineContext; wide: boolean }) {
  const width = wide ? "min-w-28 max-w-[36rem]" : "min-w-24 max-w-80";
  const rows = table.rows.map((row, r) => ({ key: `r${r}`, cells: cellsOf(row, `r${r}`) }));
  const content = (cell: Cell) => {
    const align = table.align[cell.column];
    return (
      <div className={cn(width, "whitespace-normal break-words", align && ALIGN_CLASS[align])}>
        {renderInline(cell.nodes, ctx, cell.key)}
      </div>
    );
  };
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {cellsOf(table.head, "h").map((cell) => (
            <th
              key={cell.key}
              scope="col"
              className={cn(CELL, "sticky top-0 border-b bg-muted font-medium text-foreground")}
            >
              {content(cell)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-t first:border-t-0 even:bg-muted/40">
            {row.cells.map((cell) => (
              <td key={cell.key} className={CELL}>
                {content(cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type CopyState = "idle" | "copied" | "failed";

function CopyButton({ source, labels }: { source: string; labels: MarkdownTableLabels }) {
  const [state, setState] = useState<CopyState>("idle");
  const copy = () =>
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(source))
      .then(
        () => setState("copied"),
        (e: unknown) => {
          console.error(e);
          setState("failed");
        },
      );
  return (
    <>
      <output className={cn("text-xs", state === "failed" ? "text-destructive" : "text-muted-foreground")}>
        {state === "copied" ? labels.copied : state === "failed" ? labels.copyFailed : ""}
      </output>
      <Button variant="outline" size="sm" onClick={() => void copy()}>
        <Copy />
        {labels.copy}
      </Button>
    </>
  );
}

export function MarkdownTable({ table, labels, ctx }: Props) {
  return (
    <Sheet>
      <div className="grid min-w-0 gap-1">
        <section
          aria-label={labels.table}
          className="overflow-x-auto rounded-md border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <TableGrid table={table} ctx={ctx} wide={false} />
        </section>
        <div className="flex justify-end">
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={labels.expandTable}
              className="h-6 gap-1 px-2 text-xs text-muted-foreground"
            >
              <Maximize2 />
              {labels.expand}
            </Button>
          </SheetTrigger>
        </div>
      </div>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[min(92vw,1200px)]">
        <SheetHeader>
          <SheetTitle>{labels.table}</SheetTitle>
          <SheetDescription>{labels.size(table.rows.length, table.head.length)}</SheetDescription>
        </SheetHeader>
        <div className="mx-4 min-h-0 flex-1 overflow-auto rounded-md border">
          <TableGrid table={table} ctx={ctx} wide />
        </div>
        <SheetFooter className="flex-row items-center justify-end gap-3">
          <CopyButton source={table.source} labels={labels} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
