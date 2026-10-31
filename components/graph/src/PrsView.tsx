import { useSdk } from "@kibo/sdk";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { fr } from "./fr";
import { frPrs } from "./fr-prs";
import { GraphLegend } from "./GraphLegend";
import { PrRail } from "./PrRail";
import { PrStack } from "./PrStack";
import { PrsEmpty } from "./PrsEmpty";
import { layoutStacks } from "./prs-layout";
import { PRS_LEGEND } from "./prs-legend-items";
import { useElementSize } from "./use-element-size";
import { usePrStacks } from "./use-pr-stacks";
import { usePrsKeys } from "./use-prs-keys";

const HELP_ID = "kibo-graph-prs-help";

type Props = { onCounter?(counter: string): void };

export function PrsView({ onCounter }: Props) {
  const sdk = useSdk();
  const { model, loading, failed } = usePrStacks();
  const [section, setSection] = useState<HTMLElement | null>(null);
  const size = useElementSize(section);
  const layout = useMemo(() => layoutStacks(model, size), [model, size]);
  const onKeyDown = usePrsKeys(layout);
  const empty = model.counts.open === 0;
  const counter = frPrs.counter(model.counts);

  useEffect(() => {
    if (!loading) onCounter?.(counter);
  }, [loading, counter, onCounter]);

  useLayoutEffect(() => {
    if (section === null || loading || layout.height === 0) return;
    section.scrollTop = section.scrollHeight - section.clientHeight;
  }, [section, loading, layout.height]);

  if (failed)
    return (
      <p role="alert" className="p-4 text-destructive text-sm">
        {fr.loadFailed}
      </p>
    );
  const open = (ticketId: string) => sdk.openTicket(ticketId);
  return (
    <div className="relative h-full min-h-0 bg-(--tracking-canvas)">
      <section
        ref={setSection}
        aria-label={frPrs.canvas}
        aria-describedby={empty ? undefined : HELP_ID}
        onKeyDown={onKeyDown}
        className="relative h-full overflow-auto"
      >
        {!loading && empty && <PrsEmpty />}
        {!loading && !empty && (
          <div
            className="relative min-h-full min-w-full"
            style={{ width: layout.width, height: layout.height }}
          >
            <p id={HELP_ID} className="sr-only">
              {frPrs.help}
            </p>
            <div aria-hidden className="absolute inset-x-0 top-[50px] h-px bg-(--tracking-soft)" />
            <PrRail layout={layout} rail={model.rail} />
            {layout.columns.map((column) => (
              <PrStack key={column.stack.root.id} column={column} railY={layout.railY} onOpen={open} />
            ))}
          </div>
        )}
      </section>
      {!loading && !empty && <GraphLegend items={PRS_LEGEND} />}
    </div>
  );
}
