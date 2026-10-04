import { type Diagnostics, KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Label } from "@kibo/sdk/ui/label";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { client } from "../api";
import { frReport as t } from "../i18n/fr-report";
import { errorMessage } from "../lib/error-message";
import { inTauri } from "../shell/workspace-actions";
import { ISSUE_URL, type ReportShell, reportText } from "./report-text";

type Props = {
  open: boolean;
  shell?: ReportShell;
  load?: () => Promise<Diagnostics>;
  onClose(): void;
};

type Loaded = { diagnostics: Diagnostics } | { error: string } | null;
type CopyState = "idle" | "copied" | "failed";

const loadDiagnostics = () => client.rpc({ method: "getDiagnostics" });
const describe = (e: unknown): string =>
  e instanceof KiboError && e.code === "FORBIDDEN" ? t.localOnly : errorMessage(e);

function useDiagnostics(open: boolean, load: () => Promise<Diagnostics>): Loaded {
  const [loaded, setLoaded] = useState<Loaded>(null);
  const loader = useRef(load);
  loader.current = load;
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoaded(null);
    loader.current().then(
      (diagnostics) => live && setLoaded({ diagnostics }),
      (e: unknown) => live && setLoaded({ error: describe(e) }),
    );
    return () => {
      live = false;
    };
  }, [open]);
  return loaded;
}

function ReportBody({ loaded, text }: { loaded: Loaded; text: string | null }) {
  if (loaded && "error" in loaded)
    return (
      <p role="alert" className="text-sm text-destructive">
        {t.failed(loaded.error)}
      </p>
    );
  if (text === null) return <p className="text-sm text-muted-foreground">{t.loading}</p>;
  return (
    <section aria-label={t.reportLabel}>
      <pre className="max-h-80 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">
        {text}
      </pre>
    </section>
  );
}

export function ReportDialog({
  open,
  shell = inTauri() ? "tauri" : "browser",
  load = loadDiagnostics,
  onClose,
}: Props) {
  const loaded = useDiagnostics(open, load);
  const [withLog, setWithLog] = useState(true);
  const [copy, setCopy] = useState<CopyState>("idle");
  const text =
    loaded && "diagnostics" in loaded ? reportText(loaded.diagnostics, shell, { log: withLog }) : null;
  const copyReport = async () => {
    if (text === null) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopy("copied");
    } catch (e) {
      console.error("clipboard write refused", e);
      setCopy("failed");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <ReportBody loaded={loaded} text={text} />
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox
            checked={withLog}
            onCheckedChange={(v) => {
              setWithLog(v === true);
              setCopy("idle");
            }}
          />
          {t.includeLog}
        </Label>
        <DialogFooter>
          <Button variant="outline" asChild>
            <a href={ISSUE_URL} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden />
              {t.openIssue}
            </a>
          </Button>
          <Button disabled={text === null} onClick={() => void copyReport()}>
            {copy === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copy === "copied" ? t.copied : copy === "failed" ? t.copyFailed : t.copy}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
