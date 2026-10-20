import { Layers } from "lucide-react";
import { frPrs } from "./fr-prs";
import { PrNode } from "./PrNode";
import type { PrStack as PrStackModel } from "./pr-stacks";
import { GAP_Y, NODE_H, NODE_W, type PlacedPr, type PlacedStack, RAIL_LINE } from "./prs-layout";

const LABEL_SHIFT = 8;
const LABEL_HALF = 7;

const stackDetail = (stack: PrStackModel): string => {
  const feature =
    stack.feature === null ? frPrs.noFeature : frPrs.feature(stack.feature.shortKey, stack.feature.title);
  return `${feature} · ${frPrs.range(stack.numbers.min, stack.numbers.max)}`;
};

function Line({ x, y, w = 2, h = 2 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <span
      aria-hidden
      className="absolute bg-(--tracking-faint)"
      style={{ left: x, top: y, width: w, height: h }}
    />
  );
}

function OnBase({ x, y, base }: { x: number; y: number; base: string }) {
  return (
    <span
      className="absolute whitespace-nowrap font-mono text-(--tracking-dim) text-[10.5px] leading-[13px]"
      style={{ left: x + LABEL_SHIFT, top: y - LABEL_HALF }}
    >
      {frPrs.on(base)}
    </span>
  );
}

function Link({
  placed,
  left,
  lineY,
  onRail,
}: {
  placed: PlacedPr;
  left: number;
  lineY: number;
  onRail: boolean;
}) {
  const cx = placed.x - left + NODE_W / 2;
  const bottom = placed.y + NODE_H;
  const base = placed.node.base;
  if (placed.parent === null) {
    return (
      <>
        <Line x={cx - 1} y={bottom} h={lineY - bottom} />
        {!onRail && base !== null && <OnBase x={cx} y={Math.round((bottom + lineY) / 2)} base={base} />}
      </>
    );
  }
  const px = placed.parent.x - left;
  const mid = bottom + GAP_Y / 2;
  return (
    <>
      {cx === px ? (
        <Line x={cx - 1} y={bottom} h={placed.parent.y - bottom} />
      ) : (
        <>
          <Line x={cx - 1} y={bottom} h={mid - bottom} />
          <Line x={Math.min(cx, px) - 1} y={mid - 1} w={Math.abs(cx - px) + 2} />
          <Line x={px - 1} y={mid} h={placed.parent.y - mid} />
        </>
      )}
      {base !== null && <OnBase x={cx} y={mid} base={base} />}
    </>
  );
}

type Props = { column: PlacedStack; railY: number; onOpen(ticketId: string): void };

export function PrStack({ column, railY, onOpen }: Props) {
  const { stack, nodes } = column;
  const head = Math.min(...nodes.map((p) => p.x)) - column.x;
  return (
    <fieldset
      aria-label={`${frPrs.stack(stack.size)} · ${stackDetail(stack)}`}
      className="absolute top-0 bottom-0 m-0 min-w-0 border-0 p-0"
      style={{ left: column.x, width: column.width }}
    >
      <div className="absolute top-3 flex flex-col gap-0.5" style={{ left: head }}>
        <span className="flex h-4 items-center gap-1.5 font-semibold text-(--tracking-fg) text-[13px] leading-4">
          <Layers size={13} absoluteStrokeWidth aria-hidden className="shrink-0 text-(--tracking-mfg)" />
          {frPrs.stack(stack.size)}
        </span>
        <span className="whitespace-nowrap text-(--tracking-dim) text-[11.5px] leading-[14px]">
          {stackDetail(stack)}
        </span>
      </div>
      {nodes.map((p) => (
        <Link key={p.node.id} placed={p} left={column.x} lineY={railY + RAIL_LINE} onRail={stack.onRail} />
      ))}
      {nodes.map((p) => (
        <PrNode key={p.node.id} node={p.node} x={p.x - column.x} y={p.y} onOpen={onOpen} />
      ))}
    </fieldset>
  );
}
