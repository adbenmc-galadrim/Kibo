import type { ProjectAsset } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Progress } from "@kibo/sdk/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { frFiles as t } from "../i18n/fr-files";
import type { Sending } from "./use-project-files";

const HEAD = "h-9 px-3 text-2xs font-normal text-muted-foreground";
const CELL = "px-3 py-2";

function FilesTable({ assets, onRemove }: { assets: ProjectAsset[]; onRemove(asset: ProjectAsset): void }) {
  return (
    <Table aria-label={t.list}>
      <TableHeader>
        <TableRow>
          <TableHead className={HEAD}>{t.columns.name}</TableHead>
          <TableHead className={HEAD}>{t.columns.kind}</TableHead>
          <TableHead className={HEAD}>{t.columns.size}</TableHead>
          <TableHead className={HEAD}>{t.columns.date}</TableHead>
          <TableHead className={HEAD}>
            <span className="sr-only">{t.remove}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((a) => (
          <TableRow key={a.name}>
            <TableCell className={cn(CELL, "max-w-56 truncate font-mono")}>{a.name}</TableCell>
            <TableCell className={CELL}>{t.kind(a.kind)}</TableCell>
            <TableCell className={cn(CELL, "tabular-nums")}>{t.size(a.size)}</TableCell>
            <TableCell className={cn(CELL, "text-muted-foreground")}>{t.date(a.mtime)}</TableCell>
            <TableCell className={cn(CELL, "py-1 text-right")}>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.removeLabel(a.name)}
                onClick={() => onRemove(a)}
              >
                {t.remove}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function FilesBody({
  assets,
  failed,
  onRemove,
}: {
  assets: ProjectAsset[] | null;
  failed: boolean;
  onRemove(a: ProjectAsset): void;
}) {
  if (failed)
    return (
      <p role="alert" className="text-sm text-destructive">
        {t.loadFailed}
      </p>
    );
  if (assets === null) return <p className="text-sm text-muted-foreground">{t.loading}</p>;
  if (assets.length === 0) return <p className="text-sm text-muted-foreground">{t.empty}</p>;
  return <FilesTable assets={assets} onRemove={onRemove} />;
}

export function SendingList({ sending }: { sending: Sending[] }) {
  if (sending.length === 0) return null;
  return (
    <ul aria-label={t.uploads} className="grid gap-2">
      {sending.map((s) => (
        <li key={s.key} className="grid gap-1">
          <span className="truncate font-mono text-xs text-muted-foreground">{s.name}</span>
          <Progress aria-label={t.uploading(s.name)} value={Math.round(s.ratio * 100)} />
        </li>
      ))}
    </ul>
  );
}
