import {
  CI_MARK,
  fr,
  frPrs,
  type PrNode,
  type PrReviewTone,
  type PrStack,
  usePrStacks,
} from "@kibo/component-graph/models";
import { useSdk } from "@kibo/sdk";
import { ChevronDown, GitBranch, GitPullRequest, GitPullRequestDraft } from "lucide-react";
import { frGraph } from "../../i18n/fr-graph";

export const PR_ICON_TONE: Record<PrReviewTone, string> = {
  draft: "text-(--tracking-dim)",
  waiting: "text-(--tracking-purple)",
  changes: "text-(--tracking-amber)",
  approved: "text-(--tracking-green)",
};

const nodeBorder = (node: PrNode): string => {
  if (node.review === "changes") return "border-(--tracking-red)";
  return node.session ? "border-(--tracking-brand)" : "border-(--tracking-border)";
};

const stackDetail = (stack: PrStack): string => {
  const feature =
    stack.feature === null ? frPrs.noFeature : frPrs.feature(stack.feature.shortKey, stack.feature.title);
  return `${feature} · ${frPrs.range(stack.numbers.min, stack.numbers.max)}`;
};

const rowsOf = (node: PrNode): PrNode[] => [...node.children.flatMap(rowsOf), node];

function PrCard({ node, onOpen }: { node: PrNode; onOpen(ticketId: string): void }) {
  const Icon = node.review === "draft" ? GitPullRequestDraft : GitPullRequest;
  const ci = node.checks === null ? null : CI_MARK[node.checks];
  return (
    <button
      type="button"
      aria-label={frPrs.open(node.number, node.title, node.key)}
      data-pr={node.number}
      data-review={node.review}
      data-checks={node.checks ?? undefined}
      data-session={node.session ? "true" : undefined}
      onClick={() => onOpen(node.ticketId)}
      className={`flex min-h-11 w-full flex-col gap-1.5 rounded-lg border bg-(--tracking-card) px-3 py-2.5 text-left ${nodeBorder(node)}`}
    >
      <span className="flex w-full min-w-0 items-center gap-2">
        <Icon size={15} absoluteStrokeWidth aria-hidden className={`shrink-0 ${PR_ICON_TONE[node.review]}`} />
        <span className="shrink-0 font-mono font-semibold text-[13px]">{`#${node.number}`}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-[14px] text-(--tracking-fg)">
          {node.title}
        </span>
        {node.session && (
          <span
            role="img"
            aria-label={fr.sprints.session}
            className="size-1.5 shrink-0 rounded-full bg-(--tracking-brand)"
          />
        )}
      </span>
      <span className="flex w-full min-w-0 items-center gap-2 pl-[23px] text-[12.5px]">
        <span className="shrink-0 font-mono text-(--tracking-mfg)">{node.key}</span>
        <span
          className={`min-w-0 flex-1 truncate ${node.review === "changes" ? "text-(--tracking-amber)" : "text-(--tracking-mfg)"}`}
        >
          {frPrs.review[node.review].toLocaleLowerCase("fr")}
        </span>
        {ci !== null && node.checks !== null && (
          <span className="flex shrink-0 items-center gap-1 text-(--tracking-mfg)">
            <ci.Icon size={14} absoluteStrokeWidth aria-hidden className={ci.color} />
            {frPrs.ci[node.checks]}
          </span>
        )}
      </span>
    </button>
  );
}

function OnBase({ base }: { base: string }) {
  return (
    <p className="flex h-6 items-center gap-1.5 pl-3 font-mono text-(--tracking-dim) text-[11.5px]">
      <ChevronDown size={13} absoluteStrokeWidth aria-hidden className="shrink-0" />
      {frPrs.on(base)}
    </p>
  );
}

function StackCard({ stack, onOpen }: { stack: PrStack; onOpen(ticketId: string): void }) {
  const rows = rowsOf(stack.root);
  return (
    <article
      aria-label={`${frPrs.stack(stack.size)} · ${stackDetail(stack)}`}
      className="flex flex-col gap-2 rounded-[10px] border border-(--tracking-border) border-dashed bg-(--tracking-frame) p-3"
    >
      <p className="font-mono text-(--tracking-dim) text-xs">{frPrs.stack(stack.size)}</p>
      <h3 className="font-semibold text-[15px] leading-[18px]">{stackDetail(stack)}</h3>
      <ul className="flex flex-col">
        {rows.map((node) => (
          <li key={node.id}>
            <PrCard node={node} onOpen={onOpen} />
            {node !== stack.root && node.base !== null && <OnBase base={node.base} />}
          </li>
        ))}
      </ul>
      {stack.root.base !== null && (
        <p className="flex h-7 items-center gap-2 rounded-md bg-(--tracking-muted) px-3 font-mono text-(--tracking-mfg) text-xs">
          <GitBranch size={13} absoluteStrokeWidth aria-hidden className="shrink-0" />
          {frGraph.prs.rail(stack.root.base)}
        </p>
      )}
    </article>
  );
}

export function PhonePrsView() {
  const sdk = useSdk();
  const { model, loading, failed } = usePrStacks();
  if (failed)
    return (
      <p role="alert" className="p-4 text-(--tracking-red) text-sm">
        {fr.loadFailed}
      </p>
    );
  if (loading) return null;
  const open = (ticketId: string) => sdk.openTicket(ticketId);
  return (
    <section aria-label={frPrs.canvas} className="flex flex-col gap-4 px-4 pt-4 pb-6">
      {model.counts.open === 0 ? (
        <div className="flex flex-col items-center gap-1.5 pt-16 text-center">
          <p className="font-medium text-(--tracking-mfg) text-sm">{frPrs.empty.title}</p>
          <p className="text-(--tracking-dim) text-[13px]">{frPrs.empty.hint}</p>
        </div>
      ) : (
        <>
          <p className="text-(--tracking-mfg) text-[12.5px]">{frPrs.counter(model.counts)}</p>
          {model.stacks.map((stack) => (
            <StackCard key={stack.root.id} stack={stack} onOpen={open} />
          ))}
        </>
      )}
    </section>
  );
}
