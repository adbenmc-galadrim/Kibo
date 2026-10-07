import { type DesignFrameKey, frameList, parseDesignUrl } from "@kibo/schema";
import { useEntities, useSdk } from "@kibo/sdk";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { FrameHeader } from "./FrameHeader";
import { FrameNav } from "./FrameNav";
import { FrameProblem } from "./FrameProblem";
import { FrameViewer } from "./FrameViewer";
import { fr } from "./fr";
import { LinkedTickets } from "./LinkedTickets";
import { linkedTickets } from "./linked-tickets";
import { useFrame } from "./use-frame";

type Fit = "contain" | "width";
type PanelProps = { url: string | null; frameKey: DesignFrameKey | null; fit: Fit };

const STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

function Message({ text }: { text: string }) {
  return <output className="m-auto p-4 text-center text-sm text-muted-foreground">{text}</output>;
}

function FramePanel({ url, frameKey, fit }: PanelProps) {
  const { view, refresh } = useFrame(url, frameKey);
  if (view.status === "ready") {
    return (
      <>
        <FrameHeader frame={view.frame} refreshing={view.refreshing} onRefresh={refresh} />
        <FrameViewer frame={view.frame} fit={fit} />
      </>
    );
  }
  if (view.status === "failed")
    return <FrameProblem problem={view.problem} frameKey={frameKey} onRetry={refresh} />;
  return <Message text={view.status === "loading" ? fr.loading : fr.empty} />;
}

export function Mockup() {
  const sdk = useSdk();
  const frames = useMemo(() => frameList(sdk.config.frame), [sdk.config.frame]);
  const fit: Fit = sdk.config.fit === "width" ? "width" : "contain";
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, frames.length - 1));
  const url = frames[current] ?? null;
  const key = useMemo(() => (url ? (parseDesignUrl(url)?.key ?? null) : null), [url]);
  const { data: tickets } = useEntities("ticket");
  const linked = useMemo(() => (key ? linkedTickets(tickets, key) : []), [tickets, key]);
  useEffect(() => sdk.capability("fullscreen"), [sdk]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const step = STEPS[e.key];
    if (step === undefined || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
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
      <FramePanel key={url ?? ""} url={url} frameKey={key} fit={fit} />
      {frames.length > 1 && <FrameNav index={current} count={frames.length} onChange={setIndex} />}
      {key && <LinkedTickets tickets={linked} />}
    </section>
  );
}
