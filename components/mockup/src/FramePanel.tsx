import {
  type DesignFrame,
  type DesignFrameKey,
  isHtmlFrame,
  parseDesignUrl,
  storyUrlWithOrigin,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Columns2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CompareBar } from "./CompareBar";
import { clipFor } from "./compare";
import { FrameHeader } from "./FrameHeader";
import { FrameProblem } from "./FrameProblem";
import type { Surface } from "./FrameSurface";
import { FrameViewer } from "./FrameViewer";
import { fr } from "./fr";
import { OriginMenu } from "./OriginMenu";
import type { Comparison } from "./use-compare";
import { type FrameView, useFrame } from "./use-frame";
import { useStorybooks } from "./use-storybooks";
import type { Size } from "./zoom";

type Fit = "contain" | "width";
type Props = { url: string | null; frameKey: DesignFrameKey | null; fit: Fit; compare: Comparison };

function Message({ text }: { text: string }) {
  return <output className="m-auto p-4 text-center text-sm text-muted-foreground">{text}</output>;
}

const sizeOf = (frame: DesignFrame): Size | null =>
  frame.width !== null && frame.height !== null ? { width: frame.width, height: frame.height } : null;

function useSeen(url: string | null, view: FrameView, seen: Comparison["seen"]) {
  const last = useRef(view);
  useEffect(() => {
    if (!url || last.current === view) return;
    last.current = view;
    if (view.status === "ready" && !view.refreshing) seen(url, view.frame);
    if (view.status === "failed") seen(url, null);
  }, [url, view, seen]);
}

function compared(
  story: DesignFrame,
  image: DesignFrame,
  compare: Comparison,
  refresh: () => void,
): Surface[] {
  const { mode, swapped, opacity, wipe } = compare.state;
  const overlay = mode === "overlay";
  const blend = overlay ? { opacity: opacity / 100, clip: clipFor(wipe) } : {};
  const storySurface: Surface = {
    frame: story,
    interactive: true,
    onExpired: refresh,
    ...(swapped ? blend : {}),
  };
  const imageSurface: Surface = { frame: image, interactive: !overlay, ...(swapped ? {} : blend) };
  return swapped ? [imageSurface, storySurface] : [storySurface, imageSurface];
}

export function FramePanel({ url, frameKey, fit, compare }: Props) {
  const story = frameKey?.provider === "storybook";
  const [override, setOverride] = useState<string | null>(null);
  const shownUrl = url && override ? (storyUrlWithOrigin(url, override) ?? url) : url;
  const shownKey = useMemo(
    () => (shownUrl === url ? frameKey : (parseDesignUrl(shownUrl ?? "")?.key ?? null)),
    [shownUrl, url, frameKey],
  );
  const { view, refresh } = useFrame(shownUrl, shownKey);
  const storybooks = useStorybooks(story);
  const on = story && compare.state.on;
  const reference = useFrame(on ? (compare.reference?.url ?? null) : null, compare.reference?.key ?? null);
  useSeen(url, view, compare.seen);
  useSeen(on ? (compare.reference?.url ?? null) : null, reference.view, compare.seen);

  const current = shownKey?.provider === "storybook" ? new URL(shownKey.origin).origin : "";
  const originMenu = storybooks.origins.length > 1 && (
    <OriginMenu origins={storybooks.origins} current={current} onChange={setOverride} />
  );
  const reload = () => {
    refresh();
    storybooks.reload();
  };

  if (view.status === "failed") {
    return (
      <>
        {originMenu && <div className="flex justify-end px-3 pt-2">{originMenu}</div>}
        <FrameProblem problem={view.problem} frameKey={shownKey} onRetry={reload} />
      </>
    );
  }
  if (view.status !== "ready") return <Message text={view.status === "loading" ? fr.loading : fr.empty} />;

  const frame = view.frame;
  const image = on && reference.view.status === "ready" ? reference.view.frame : null;
  const surfaces: Surface[] =
    image && !isHtmlFrame(image)
      ? compared(frame, image, compare, refresh)
      : [{ frame, interactive: true, onExpired: isHtmlFrame(frame) ? refresh : undefined }];
  const pair = surfaces.length > 1;
  return (
    <>
      <FrameHeader frame={frame} refreshing={view.refreshing} onRefresh={reload}>
        {originMenu}
        {story && compare.available && (
          <Button
            variant="ghost"
            size="xs"
            aria-pressed={on}
            onClick={() => compare.dispatch({ kind: "toggle" })}
          >
            <Columns2 aria-hidden />
            {fr.compare.open}
          </Button>
        )}
      </FrameHeader>
      {on && <CompareBar state={compare.state} references={compare.references} dispatch={compare.dispatch} />}
      <FrameViewer
        surfaces={surfaces}
        size={pair && image ? sizeOf(image) : isHtmlFrame(frame) ? null : sizeOf(frame)}
        mode={pair ? compare.state.mode : null}
        fit={fit}
        name={frame.name}
      />
    </>
  );
}
