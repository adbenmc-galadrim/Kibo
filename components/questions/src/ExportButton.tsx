import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@kibo/sdk/ui/popover";
import { Copy, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { ExportToast } from "./ExportToast";
import { type ExportEntry, exportAll, exportDate } from "./export-text";
import { fr } from "./fr";

type Props = {
  label: string;
  recipient: string;
  summary: string;
  entries: readonly ExportEntry[];
  variant?: "outline" | "ghost";
  className?: string;
};

const TOOLBAR_BUTTON = "h-6.5 text-xs";

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    console.warn(e);
  }
}

export function ExportButton({ label, recipient, summary, entries, variant, className }: Props) {
  const sdk = useSdk();
  const [text, setText] = useState<string | null>(null);
  const [marked, setMarked] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [undoFailed, setUndoFailed] = useState(false);
  const closeToast = useCallback(() => setMarked(null), []);
  const run = async (command: () => Promise<unknown>) => {
    setFailed(false);
    try {
      await command();
      return true;
    } catch (e) {
      console.error(e);
      setFailed(true);
      return false;
    }
  };
  const exportNow = async () => {
    const next = exportAll(recipient, exportDate(Date.now()), entries);
    setText(next);
    await copy(next);
    const questionIds = entries.map((e) => e.question.id);
    const by = { kind: "human", ref: sdk.viewer } as const;
    if (await run(() => sdk.run({ method: "markQuestionsExported", questionIds, by })))
      setMarked(questionIds);
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
  return (
    <Popover open={text !== null} onOpenChange={(open) => !open && setText(null)}>
      <PopoverAnchor asChild>
        <Button
          type="button"
          variant={variant ?? "outline"}
          size="sm"
          className={className ?? TOOLBAR_BUTTON}
          disabled={entries.length === 0}
          onClick={() => void exportNow()}
        >
          <Upload aria-hidden />
          {label}
        </Button>
      </PopoverAnchor>
      <PopoverContent align="end" className="grid w-105 gap-2.5 rounded-[10px] bg-card p-3.5">
        <header className="flex items-center gap-2">
          <h3 className="flex-1 text-sm font-semibold">{fr.exporting.preview}</h3>
          <span className="text-xs text-muted-foreground">{summary}</span>
        </header>
        <pre className="max-h-72 overflow-auto rounded-md bg-muted px-3 py-2.5 font-mono text-xs leading-[1.75] whitespace-pre-wrap select-all">
          {text}
        </pre>
        <footer className="flex items-center gap-2">
          <p className="flex-1 text-xs text-muted-foreground">{fr.exporting.help}</p>
          <Button type="button" size="sm" className="h-6.5 text-xs" onClick={() => void copy(text ?? "")}>
            <Copy aria-hidden />
            {fr.exporting.copy}
          </Button>
        </footer>
      </PopoverContent>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {fr.exporting.failed}
        </p>
      )}
      {marked !== null && (
        <ExportToast
          count={marked.length}
          undoFailed={undoFailed}
          onUndo={() => void undo()}
          onClose={closeToast}
        />
      )}
    </Popover>
  );
}
