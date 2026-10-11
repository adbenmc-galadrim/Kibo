import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Share } from "lucide-react";
import { useState } from "react";
import { type ExportEntry, exportAll } from "./export-text";
import { fr } from "./fr";

type Props = { label: string; entries: readonly ExportEntry[] };

async function copied(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export function ExportButton({ label, entries }: Props) {
  const sdk = useSdk();
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const exportNow = async () => {
    const text = exportAll(entries);
    setBusy(true);
    setFailed(false);
    setFallback((await copied(text)) ? null : text);
    try {
      for (const e of entries) await sdk.run({ method: "markQuestionSent", questionId: e.question.id });
    } catch (e) {
      console.error(e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={busy || entries.length === 0}
        onClick={() => void exportNow()}
      >
        <Share aria-hidden />
        {label}
      </Button>
      {fallback !== null && (
        <div className="grid w-full gap-1">
          <Textarea
            aria-label={fr.exporting.fallback}
            readOnly
            rows={6}
            className="font-mono text-xs"
            value={fallback}
            ref={(el) => el?.select()}
          />
          <p className="text-2xs text-muted-foreground">{fr.exporting.fallbackHelp}</p>
        </div>
      )}
      {failed && (
        <p role="alert" className="w-full text-xs text-destructive">
          {fr.exporting.failed}
        </p>
      )}
    </>
  );
}
