import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@kibo/sdk/ui/popover";
import { Copy, Upload } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { ExportToast } from "./ExportToast";
import { type ExportEntry, exportAll, exportDate } from "./export-text";
import { fr } from "./fr";

export const PAGE_ACTION =
  "h-[25px] gap-[6px] rounded-[6px] px-[10px] text-[12px] font-medium shadow-none has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[13px]";

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    console.warn(e);
  }
}

export function useExportFlow(recipient: string, entries: readonly ExportEntry[]) {
  const sdk = useSdk();
  const [text, setText] = useState<string | null>(null);
  const [marked, setMarked] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [undoFailed, setUndoFailed] = useState(false);
  const closeToast = useCallback(() => setMarked(null), []);
  const start = async () => {
    const next = exportAll(recipient, exportDate(Date.now()), entries);
    setText(next);
    setFailed(false);
    await copy(next);
    const questionIds = entries.map((e) => e.question.id);
    try {
      const by = { kind: "human", ref: sdk.viewer } as const;
      await sdk.run({ method: "markQuestionsExported", questionIds, by });
      setMarked(questionIds);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
  const undo = async () => {
    setUndoFailed(false);
    try {
      await sdk.run({ method: "unmarkQuestionsExported", questionIds: marked ?? [] });
      setMarked(null);
    } catch (e) {
      console.error(e);
      setUndoFailed(true);
    }
  };
  return { text, marked, failed, undoFailed, closeToast, start, undo, close: () => setText(null) };
}

type Flow = ReturnType<typeof useExportFlow>;

export function ExportSurface({
  flow,
  summary,
  children,
}: {
  flow: Flow;
  summary: string;
  children: ReactNode;
}) {
  return (
    <Popover open={flow.text !== null} onOpenChange={(open) => !open && flow.close()}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent align="end" className="grid w-105 gap-2.5 rounded-[10px] bg-card p-3.5">
        <header className="flex items-center gap-2">
          <h3 className="flex-1 text-sm font-semibold">{fr.exporting.preview}</h3>
          <span className="text-xs text-muted-foreground">{summary}</span>
        </header>
        <pre className="max-h-72 overflow-auto rounded-md bg-muted px-3 py-2.5 font-mono text-xs leading-[1.75] whitespace-pre-wrap select-all">
          {flow.text}
        </pre>
        <footer className="flex items-center gap-2">
          <p className="flex-1 text-xs text-muted-foreground">{fr.exporting.help}</p>
          <Button
            type="button"
            size="sm"
            className="h-6.5 text-xs"
            onClick={() => void copy(flow.text ?? "")}
          >
            <Copy aria-hidden />
            {fr.exporting.copy}
          </Button>
        </footer>
      </PopoverContent>
      {flow.failed && (
        <p role="alert" className="text-xs text-destructive">
          {fr.exporting.failed}
        </p>
      )}
      {flow.marked !== null && (
        <ExportToast
          count={flow.marked.length}
          undoFailed={flow.undoFailed}
          onUndo={() => void flow.undo()}
          onClose={flow.closeToast}
        />
      )}
    </Popover>
  );
}

type Props = { label: string; recipient: string; summary: string; entries: readonly ExportEntry[] };

export function ExportButton({ label, recipient, summary, entries }: Props) {
  const flow = useExportFlow(recipient, entries);
  return (
    <ExportSurface flow={flow} summary={summary}>
      <Button
        type="button"
        variant="outline"
        className={PAGE_ACTION}
        disabled={entries.length === 0}
        onClick={() => void flow.start()}
      >
        <Upload aria-hidden />
        {label}
      </Button>
    </ExportSurface>
  );
}
