import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Bot } from "lucide-react";
import { useState } from "react";
import { frSprint } from "../../i18n/fr-sprint";
import type { SprintProposal } from "./sprint-proposal";

export type SprintDecision =
  | { batchId: string; decision: "apply"; actionIds: number[] }
  | { batchId: string; decision: "reject" };

type Props = {
  proposal: SprintProposal | null;
  editable: boolean;
  decide(decision: SprintDecision): Promise<void>;
};

const t = frSprint.report;
const BUTTON = "h-[25px] rounded-[6px] px-[10px] text-[12px] leading-[15px] font-medium shadow-none";

export function SprintReportBanner({ proposal, editable, decide }: Props) {
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!proposal) return null;
  const apply = () =>
    decide({
      batchId: proposal.batchId,
      decision: "apply",
      actionIds: proposal.moves.map((m) => m.actionId),
    }).catch(() => setError(t.failed));
  return (
    <section
      aria-label={t.label}
      className="flex min-h-[47px] items-center gap-[10px] rounded-[8px] border border-(--tracking-brand-line) bg-(--tracking-brand-soft) px-[12px] py-[8px]"
    >
      <span className="grid size-[24px] shrink-0 place-items-center rounded-full border border-(--tracking-brand-line) text-(--tracking-brand)">
        <Bot absoluteStrokeWidth size={13} aria-hidden className="size-[13px]" />
      </span>
      <p className="min-w-0 flex-1 text-[12.5px] leading-[15px] text-(--tracking-fg)">
        {t.text(proposal.moves)}
        {error && (
          <span role="alert" className="block text-(--tracking-red)">
            {error}
          </span>
        )}
      </p>
      {editable && (
        <>
          <Button
            className={`${BUTTON} bg-(--tracking-brand-btn) text-white hover:bg-(--tracking-brand-btn)/90`}
            onClick={() => void apply()}
          >
            {t.apply}
          </Button>
          <Button variant="outline" className={`${BUTTON} bg-transparent`} onClick={() => setRejecting(true)}>
            {t.reject}
          </Button>
        </>
      )}
      <ConfirmDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={t.rejectTitle(proposal.seq)}
        description={t.rejectHelp}
        confirmLabel={t.reject}
        cancelLabel={t.cancel}
        onConfirm={() => decide({ batchId: proposal.batchId, decision: "reject" })}
      />
    </section>
  );
}
