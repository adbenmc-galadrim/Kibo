import { HOLD_REASON_MAX } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Pause } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { frHold } from "../i18n/fr-hold";

type Props = {
  ticketKey: string;
  suggestions: readonly string[];
  busy: boolean;
  error: string | null;
  onConfirm(reason: string): void;
  onCancel(): void;
};

const t = frHold.dialog;
const OUTLINE = "h-[25px] gap-[6px] rounded-[6px] px-[10px] py-[5px] text-[12px] leading-[15px] font-medium";
const FOOTER_BUTTON = "h-[30px] rounded-[6px] px-[14px] py-[7px] text-[13px] leading-4 font-medium";

function Suggestions({ reasons, onPick }: { reasons: readonly string[]; onPick(reason: string): void }) {
  if (reasons.length === 0) return null;
  return (
    <div className="grid gap-[8px]">
      <p className="text-[12.5px] leading-[15px] text-(--tracking-mfg)">{t.suggestions}</p>
      <div className="flex flex-wrap items-center gap-[6px]">
        {reasons.map((r) => (
          <Button key={r} type="button" variant="outline" className={OUTLINE} onClick={() => onPick(r)}>
            <Pause absoluteStrokeWidth size={13} aria-hidden className="size-[13px] text-(--tracking-mfg)" />
            {r}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function HoldDialog(p: Props) {
  const id = useId();
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const length = Array.from(trimmed).length;
  const tooLong = length > HOLD_REASON_MAX;
  const valid = length > 0 && !tooLong;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid && !p.busy) p.onConfirm(trimmed);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && p.onCancel()}>
      <DialogContent className="gap-[18px] rounded-[12px] p-6 sm:max-w-[480px]">
        <div className="grid gap-[6px] pr-7">
          <DialogTitle className="text-[18px] leading-[22px] font-semibold">
            {t.title(p.ticketKey)}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.45] text-(--tracking-mfg)">
            {t.description}
          </DialogDescription>
        </div>
        <form onSubmit={submit} className="grid gap-[18px]">
          <div className="grid gap-[6px]">
            <div className="flex items-center">
              <Label htmlFor={id} className="text-[13px] leading-4 font-medium">
                {t.reason}
              </Label>
              <span
                className={cn(
                  "ml-auto font-mono text-[12px] leading-[15px]",
                  tooLong ? "text-(--tracking-red)" : "text-(--tracking-dim)",
                )}
              >
                {t.counter(length)}
              </span>
            </div>
            <Input
              id={id}
              value={reason}
              placeholder={t.placeholder}
              autoFocus
              aria-invalid={tooLong || undefined}
              className="h-9 rounded-[6px] px-3 text-[13px] md:text-[13px]"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Suggestions reasons={p.suggestions} onPick={setReason} />
          {p.error && (
            <p role="alert" className="text-sm text-destructive">
              {p.error}
            </p>
          )}
          <div className="flex items-center justify-end gap-[8px] pt-[4px]">
            <Button type="button" variant="outline" className={FOOTER_BUTTON} onClick={p.onCancel}>
              {t.cancel}
            </Button>
            <Button type="submit" variant="agent" className={FOOTER_BUTTON} disabled={!valid || p.busy}>
              {t.confirm}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
