import { frameList, parseDesignUrl } from "@kibo/schema";
import { useEntities, useSdk } from "@kibo/sdk";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { FrameNav } from "./FrameNav";
import { FramePanel } from "./FramePanel";
import { fr } from "./fr";
import { LinkedTickets } from "./LinkedTickets";
import { linkedTickets } from "./linked-tickets";
import { useCompare } from "./use-compare";

type Fit = "contain" | "width";

const STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

export function Mockup() {
  const sdk = useSdk();
  const frames = useMemo(() => frameList(sdk.config.frame), [sdk.config.frame]);
  const fit: Fit = sdk.config.fit === "width" ? "width" : "contain";
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, frames.length - 1));
  const url = frames[current] ?? null;
  const key = useMemo(() => (url ? (parseDesignUrl(url)?.key ?? null) : null), [url]);
  const compare = useCompare(frames, current);
  const { data: tickets } = useEntities("ticket");
  const linked = useMemo(() => (key ? linkedTickets(tickets, key) : []), [tickets, key]);
  useEffect(() => sdk.capability("fullscreen"), [sdk]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const step = STEPS[e.key];
    if (step === undefined || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target instanceof HTMLInputElement) return;
    const next = current + step;
    if (next < 0 || next >= frames.length) return;
    e.preventDefault();
    setIndex(next);
  };

  return (
    <section
      aria-label={fr.title}
      tabIndex={-1}
      className="flex h-full min-h-0 flex-col outline-none"
      onKeyDown={onKeyDown}
    >
      <FramePanel key={url ?? ""} url={url} frameKey={key} fit={fit} compare={compare} />
      {frames.length > 1 && <FrameNav index={current} count={frames.length} onChange={setIndex} />}
      {key && <LinkedTickets tickets={linked} story={key.provider === "storybook"} />}
    </section>
  );
}
