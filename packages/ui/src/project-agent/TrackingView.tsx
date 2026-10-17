import type { Batch } from "@kibo/schema";
import { RefreshCw } from "lucide-react";
import { type ReactNode, useId } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { AgentText } from "../moments/AgentText";
import type { Decision } from "./BatchCard";
import type { DiffLabels } from "./batch-groups";
import { ComposeBox } from "./ComposeBox";
import { PendingBatch } from "./PendingBatch";

type Props = {
  projectId: string;
  projectName: string;
  summary: string | null;
  batch: Batch | null;
  labels: DiffLabels;
  onTicket(key: string): void;
  onDecide(batchId: string, d: Decision): Promise<void>;
  onSend(text: string): Promise<void>;
};

const t = frProjectAgent.tracking;
const HEADING = "text-[12px] leading-[1.2] font-semibold tracking-[0.5px] text-(--tracking-mfg) uppercase";
const SUMMARY =
  "gap-[8px] text-[13px] leading-[1.55] text-(--tracking-mfg) [&>:first-child]:text-[14px] [&>:first-child]:leading-[1.45] [&>:first-child]:font-medium [&>:first-child]:text-(--tracking-fg)";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-[10px]">
      <h2 id={id} className={HEADING}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function TrackingView({
  projectId,
  projectName,
  summary,
  batch,
  labels,
  onTicket,
  onDecide,
  onSend,
}: Props) {
  const id = useId();
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-(--tracking-panel)">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section
          aria-labelledby={id}
          className="flex flex-col gap-[8px] border-b border-(--tracking-soft) p-[18px]"
        >
          <h2 id={id} className={HEADING}>
            {t.summary}
          </h2>
          {summary ? (
            <AgentText text={summary} onTicket={onTicket} className={SUMMARY} />
          ) : (
            <p className="text-[13px] leading-[1.55] text-(--tracking-mfg)">{t.noSummary(projectName)}</p>
          )}
        </section>
        <div className="flex flex-col gap-[10px] p-[18px]">
          {batch && (
            <Section title={t.toValidate}>
              <PendingBatch
                key={batch.id}
                batch={batch}
                labels={labels}
                onDecide={(d) => onDecide(batch.id, d)}
              />
            </Section>
          )}
          <p className="flex gap-[8px] pt-[4px] text-[12px] leading-[1.5] text-(--tracking-mfg)">
            <RefreshCw aria-hidden className="mt-[2px] size-[13px] shrink-0" />
            {t.footer}
          </p>
        </div>
      </div>
      <ComposeBox projectId={projectId} placeholder={t.ask} compact onSend={onSend} />
    </div>
  );
}
