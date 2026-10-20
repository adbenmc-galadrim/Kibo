import { cn } from "@kibo/sdk/lib/utils";
import {
  CircleCheck,
  CircleX,
  ClockAlert,
  GitBranch,
  GitPullRequest,
  GitPullRequestDraft,
  LoaderCircle,
  type LucideIcon,
  Package,
} from "lucide-react";
import { RING_CLASS } from "./FrameStepRow";
import { frPrs } from "./fr-prs";
import type { PrNode as PrNodeModel, PrReviewTone } from "./pr-stacks";
import { NODE_H, NODE_W } from "./prs-layout";

const REVIEW_DOT: Record<PrReviewTone, string> = {
  draft: cn("size-[7px] shrink-0", RING_CLASS),
  waiting: "size-[7px] shrink-0 rounded-full bg-(--tracking-purple)",
  changes: "size-[7px] shrink-0 rounded-full bg-(--tracking-red)",
  approved: "size-[7px] shrink-0 rounded-full bg-(--tracking-green)",
};

export const CI_MARK: Record<"ok" | "error" | "running", { Icon: LucideIcon; color: string }> = {
  ok: { Icon: CircleCheck, color: "text-(--tracking-green)" },
  error: { Icon: CircleX, color: "text-(--tracking-red)" },
  running: { Icon: LoaderCircle, color: "text-(--tracking-amber)" },
};

const CHIP =
  "flex h-[18px] shrink-0 items-center rounded-[10px] border border-(--tracking-border) px-1.5 font-medium text-[11px] leading-[14px]";

export function ReviewMark({ tone, size = 7 }: { tone: PrReviewTone; size?: number }) {
  return <span aria-hidden className={REVIEW_DOT[tone]} style={{ width: size, height: size }} />;
}

function Marks({ node }: { node: PrNodeModel }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2 text-[11px] leading-[14px]">
      {node.late && (
        <span className="flex items-center gap-1 text-(--tracking-red)">
          <ClockAlert size={12} absoluteStrokeWidth aria-hidden />
          {frPrs.late}
        </span>
      )}
      {node.session && (
        <span className="flex items-center gap-[5px] text-(--tracking-brand-text)">
          <span aria-hidden className="size-1.5 rounded-full bg-(--tracking-brand)" />
          {frPrs.session}
        </span>
      )}
    </span>
  );
}

function FeatureLine({ node }: { node: PrNodeModel }) {
  return (
    <span className="flex h-[15px] min-w-0 items-center gap-1.5 text-(--tracking-mfg) text-xs leading-[15px]">
      <span className="shrink-0 rounded-[4px] border border-(--tracking-border) px-1 font-medium font-mono text-(--tracking-fg) text-[10.5px] leading-[13px]">
        {node.key}
      </span>
      {node.feature === null ? (
        <span className="truncate">{frPrs.noFeature}</span>
      ) : (
        <>
          <Package size={12} absoluteStrokeWidth aria-hidden className="shrink-0" />
          <span className="truncate">{frPrs.feature(node.feature.shortKey, node.feature.title)}</span>
        </>
      )}
    </span>
  );
}

function ChipsLine({ node }: { node: PrNodeModel }) {
  const ci = node.checks === null ? null : CI_MARK[node.checks];
  return (
    <span className="flex h-[18px] min-w-0 items-center gap-[5px]">
      <span
        className={cn(
          CHIP,
          "gap-[5px]",
          node.review === "changes" ? "text-(--tracking-red)" : "text-(--tracking-mfg)",
        )}
      >
        <ReviewMark tone={node.review} />
        {frPrs.review[node.review]}
      </span>
      {ci !== null && node.checks !== null && (
        <span className={cn(CHIP, "gap-1 text-(--tracking-mfg)")}>
          <ci.Icon size={12} absoluteStrokeWidth aria-hidden className={ci.color} />
          {frPrs.ci[node.checks]}
        </span>
      )}
      {node.head !== null && (
        <span className="ml-auto flex min-w-0 items-center gap-[5px] text-(--tracking-dim)">
          <GitBranch size={11} absoluteStrokeWidth aria-hidden className="shrink-0" />
          <span className="truncate font-mono text-[10.5px] leading-[13px]">{node.head}</span>
        </span>
      )}
    </span>
  );
}

type Props = { node: PrNodeModel; x: number; y: number; onOpen(ticketId: string): void };

export function PrNode({ node, x, y, onOpen }: Props) {
  const Icon = node.review === "draft" ? GitPullRequestDraft : GitPullRequest;
  return (
    <button
      type="button"
      aria-label={frPrs.open(node.number, node.title, node.key)}
      data-pr={node.number}
      data-pr-id={node.id}
      data-review={node.review}
      data-checks={node.checks ?? undefined}
      data-session={node.session ? "true" : undefined}
      onClick={() => onOpen(node.ticketId)}
      className={cn(
        "absolute flex cursor-pointer flex-col gap-[9px] rounded-[8px] border bg-(--tracking-card) p-[11px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
        node.review === "changes" ? "border-(--tracking-red)" : "border-(--tracking-border)",
      )}
      style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
    >
      <span className="flex h-4 w-full min-w-0 items-center gap-[7px]">
        <Icon
          size={14}
          absoluteStrokeWidth
          aria-hidden
          className={cn(
            "shrink-0",
            node.review === "draft" ? "text-(--tracking-dim)" : "text-(--tracking-green)",
          )}
        />
        <span className="shrink-0 font-mono text-(--tracking-mfg) text-[12.5px] leading-[15px]">{`#${node.number}`}</span>
        <span className="truncate font-semibold text-(--tracking-fg) text-[13px] leading-4">
          {node.title}
        </span>
        <Marks node={node} />
      </span>
      <FeatureLine node={node} />
      <ChipsLine node={node} />
    </button>
  );
}
