import type { Batch } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { History, Pin, RefreshCw } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { formatClock } from "../agents/format";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { AgentText } from "../moments/AgentText";
import type { Decision } from "./BatchCard";
import { BatchRecap } from "./BatchRecap";
import type { DiffLabels } from "./batch-groups";
import { ComposeBox } from "./ComposeBox";
import { type ConversationItem, trackingThread } from "./conversation";
import { PendingBatch } from "./PendingBatch";
import { TrackingExchange } from "./TrackingExchange";

type Props = {
  projectId: string;
  projectName: string;
  items: readonly ConversationItem[];
  batch: Batch | null;
  superseded: number;
  labels: DiffLabels;
  onTicket(key: string): void;
  onDecide(batchId: string, d: Decision): Promise<Batch>;
  onSend(text: string): Promise<void>;
  onShowSuperseded(): void;
};
type Recap = { batch: Batch; labels: DiffLabels };

const t = frProjectAgent.tracking;
const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const sameDay = (a: number, b: number): boolean => new Date(a).toDateString() === new Date(b).toDateString();
const summaryTime = (at: number, today: boolean): string =>
  today ? formatClock(at) : t.summaryDay(DAY.format(at), formatClock(at));
const HEADING = "text-[12px] leading-[15px] font-semibold tracking-[0.5px] text-(--tracking-mfg) uppercase";
const SUMMARY =
  "gap-[8px] text-[13px] leading-[20.33px] text-(--tracking-mfg) [&>:first-child]:text-[14px] [&>:first-child]:leading-[21px] [&>:first-child]:font-medium [&>:first-child]:text-(--tracking-fg)";

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

function SupersededLine({ count, onShow }: { count: number; onShow(): void }) {
  return (
    <p className="flex items-center gap-[6px] text-[11.5px] leading-[14px] whitespace-nowrap text-(--tracking-mfg)">
      <History aria-hidden className="size-[13px] shrink-0" />
      <span className="truncate">{t.superseded(count)}</span>
      <Button
        variant="ghost"
        className="ml-auto h-auto shrink-0 p-0 text-[11.5px] leading-[14px] font-medium text-(--tracking-fg) hover:bg-transparent hover:underline"
        aria-label={t.showSuperseded}
        onClick={onShow}
      >
        {t.show}
      </Button>
    </p>
  );
}

export function TrackingView({
  projectId,
  projectName,
  items,
  batch,
  superseded,
  labels,
  onTicket,
  onDecide,
  onSend,
  onShowSuperseded,
}: Props) {
  const id = useId();
  const [recap, setRecap] = useState<Recap | null>(null);
  const now = Date.now();
  const { summary, summaryAt, exchange } = trackingThread(items);
  const today = summaryAt === null || summaryAt > now || sameDay(summaryAt, now);
  const asking = exchange.length > 0;
  const decide = async (pending: Batch, d: Decision) => {
    const decidedWith = labels;
    const result = await onDecide(pending.id, d);
    if (d.decision === "apply") setRecap({ batch: result, labels: decidedWith });
  };
  const card = batch && (
    <PendingBatch key={batch.id} batch={batch} labels={labels} onDecide={(d) => decide(batch, d)} />
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-(--tracking-panel)">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section
          aria-labelledby={id}
          className="sticky top-0 z-10 flex flex-col gap-[8px] border-b border-(--tracking-soft) bg-(--tracking-panel) p-[18px]"
        >
          <div className="flex items-center gap-[6px]">
            {asking && <Pin aria-hidden className="size-[12px] text-(--tracking-mfg)" />}
            <h2 id={id} className={HEADING}>
              {today ? t.summary : t.earlierSummary}
            </h2>
            <span className="ml-auto flex gap-[6px] text-[12px] text-(--tracking-mfg)">
              {summaryAt !== null && (
                <time dateTime={new Date(summaryAt).toISOString()}>{summaryTime(summaryAt, today)}</time>
              )}
              {asking && <span>{t.pinned}</span>}
            </span>
          </div>
          {summary ? (
            <AgentText text={summary} onTicket={onTicket} className={SUMMARY} />
          ) : (
            <p className="text-[13px] leading-[1.55] text-(--tracking-mfg)">{t.noSummary(projectName)}</p>
          )}
        </section>
        <div className="flex flex-col gap-[10px] p-[18px]">
          {asking && <TrackingExchange items={exchange} onTicket={onTicket} />}
          {recap && <BatchRecap batch={recap.batch} labels={recap.labels} onClose={() => setRecap(null)} />}
          {card && (asking ? card : <Section title={t.toValidate}>{card}</Section>)}
          {superseded > 0 && <SupersededLine count={superseded} onShow={onShowSuperseded} />}
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
