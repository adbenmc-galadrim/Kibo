import { RESUME_AFTER_ALLOW } from "@kibo/schema";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@kibo/sdk/ui/alert-dialog";
import { Button } from "@kibo/sdk/ui/button";
import { Play } from "lucide-react";
import { useState } from "react";
import { type Allowance, tilde } from "./denial-logic";
import { fr } from "./fr";

type Props = {
  allowance: Allowance | null;
  runLabel: string;
  onOpenChange(open: boolean): void;
  onConfirm(allowance: Allowance): Promise<void>;
};

export const AGENT_ACCENT_SOLID = "bg-brand-strong text-white hover:bg-brand-strong/90";

const t = fr.denials;

function Values({ label, values }: { label: string; values: readonly string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium">{label}</p>
      <ul aria-label={label} className="grid gap-0.5 font-mono text-xs">
        {values.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
    </div>
  );
}

export function AllowResumeDialog({ allowance, runLabel, onOpenChange, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  if (allowance === null) return null;
  const dirs = allowance.addDirs.map(tilde);
  const confirm = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await onConfirm(allowance);
      onOpenChange(false);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open onOpenChange={(open) => !busy && onOpenChange(open)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{t.confirmHelp}</AlertDialogDescription>
        </AlertDialogHeader>
        <Values label={t.rulesAdded(allowance.rules.length)} values={allowance.rules} />
        <Values label={t.dirsAdded(dirs.length)} values={dirs} />
        <div className="grid gap-1 rounded-md bg-muted px-3 py-2 text-xs">
          <p className="text-muted-foreground">{t.message(runLabel)}</p>
          <p>{`« ${RESUME_AFTER_ALLOW(allowance.rules, dirs)} »`}</p>
        </div>
        {allowance.left.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t.notTaken(allowance.left.map((i) => tilde(i.rule ?? i.addDir ?? i.target)).join(" · "))}
          </p>
        )}
        {failed !== null && (
          <p role="alert" className="text-sm text-destructive">
            {t.failed(failed)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{fr.cancel}</AlertDialogCancel>
          <Button className={AGENT_ACCENT_SOLID} disabled={busy} onClick={() => void confirm()}>
            <Play aria-hidden />
            {t.allow}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
