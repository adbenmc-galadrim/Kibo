import type { DeliveryImportCandidate, ProjectMeta } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { Table, TableBody, TableCell, TableRow } from "@kibo/sdk/ui/table";
import { ArrowRight, Download } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { client } from "../api";
import { frDeliverySettings } from "../i18n/fr-delivery-settings";
import { expandHome, tildify } from "../lib/expand-home";
import { type ImportSide, importRows } from "./delivery-import-rows";

type Props = {
  projectId: string;
  home: string;
  current: ImportSide;
  onClose(): void;
  onImported(meta: ProjectMeta): void;
};
type Registry = { registryPath: string; candidates: DeliveryImportCandidate[] };

const t = frDeliverySettings.import;

function Preview({ before, after }: { before: ImportSide; after: ImportSide }) {
  return (
    <Table aria-label={t.preview} className="text-xs">
      <TableBody>
        {importRows(before, after).map((row) => (
          <TableRow key={row.label}>
            <TableCell className="w-36 align-top whitespace-normal text-muted-foreground">
              {row.label}
            </TableCell>
            <TableCell className="align-top font-mono whitespace-normal text-muted-foreground">
              {row.before}
            </TableCell>
            <TableCell className="w-5 px-0 align-top">
              <ArrowRight aria-hidden className="size-3 text-muted-foreground" />
            </TableCell>
            <TableCell className="align-top font-mono break-all whitespace-normal">{row.after}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DeliveryImportDialog({ projectId, home, current, onClose, onImported }: Props) {
  const id = useId();
  const [path, setPath] = useState("");
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (registryPath?: string) => {
      setProblem(null);
      try {
        const read = await client.rpc({
          method: "projects.importDelivery",
          ...(registryPath ? { registryPath } : {}),
        });
        setRegistry(read);
        setPath(tildify(read.registryPath, home));
        setChosen(read.candidates.find((c) => c.matched === projectId)?.name ?? null);
      } catch {
        setRegistry(null);
        setProblem(t.failed);
      }
    },
    [home, projectId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const matching = registry?.candidates.filter((c) => c.matched === projectId) ?? [];
  const candidate = matching.find((c) => c.name === chosen) ?? null;
  const apply = async () => {
    if (!candidate || !registry) return;
    setBusy(true);
    setProblem(null);
    try {
      const meta = await client.rpc({
        method: "projects.applyDeliveryImport",
        projectId,
        name: candidate.name,
        registryPath: registry.registryPath,
      });
      onImported(meta);
    } catch {
      setProblem(t.applyFailed);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-registry`}>{t.registry}</Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-registry`}
              value={path}
              spellCheck={false}
              className="font-mono text-xs md:text-xs"
              onChange={(e) => setPath(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={() => void load(expandHome(path, home))}>
              {t.reload}
            </Button>
          </div>
        </div>
        {registry === null && problem === null && (
          <p className="text-sm text-muted-foreground">{t.loading}</p>
        )}
        {registry !== null && matching.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.noMatch}</p>
        )}
        {matching.length > 0 && (
          <RadioGroup value={chosen ?? ""} onValueChange={setChosen} className="grid gap-2">
            {matching.map((c) => (
              <div key={c.name} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <RadioGroupItem id={`${id}-${c.name}`} value={c.name} />
                <Label htmlFor={`${id}-${c.name}`} className="min-w-0 flex-1 gap-2">
                  <span className="font-mono font-semibold">{c.name}</span>
                  <span className="truncate font-mono text-xs font-normal text-muted-foreground">
                    {tildify(c.repo, home)}
                  </span>
                </Label>
                <Badge variant="outline" className="border-green-600/40 text-green-700 dark:text-green-400">
                  {t.matches}
                </Badge>
              </div>
            ))}
          </RadioGroup>
        )}
        {candidate && (
          <section aria-label={t.preview} className="grid gap-2">
            <h3 className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.preview}
            </h3>
            <Preview before={current} after={candidate.preview} />
            {candidate.notices.length > 0 && (
              <ul className="grid gap-0.5 text-xs text-amber-700 dark:text-amber-400">
                {candidate.notices.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">{t.help}</p>
          </section>
        )}
        {problem !== null && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={!candidate || busy} onClick={() => void apply()}>
            <Download aria-hidden />
            {t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
