import { type ComponentFormat, type ComponentManifest, defaultFormatOf, formatsOf } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { fr } from "../i18n/fr";
import { frCreations } from "../i18n/fr-creations";
import { useTheme } from "../theme";
import { FormatPicker } from "./FormatPicker";

const DraftPreviewFrame = lazyPanel(
  () => import("./DraftPreviewFrame").then((m) => m.DraftPreviewFrame),
  fr.lazy,
);

const t = frCreations.preview;

function useAvailableWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export function DraftPreview({ draftId, manifest }: { draftId: string; manifest: ComponentManifest }) {
  const theme = useTheme();
  const formats = formatsOf(manifest);
  const [format, setFormat] = useState<ComponentFormat>(() => defaultFormatOf(manifest));
  const frame = useRef<HTMLDivElement>(null);
  const available = useAvailableWidth(frame);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {formats.length > 1 && <FormatPicker formats={formats} value={format} onChange={setFormat} />}
        <p className="ml-auto text-xs text-muted-foreground">{t.note}</p>
      </div>
      <div
        ref={frame}
        className="flex max-h-[60vh] min-h-32 justify-center-safe overflow-y-auto overflow-x-hidden rounded-md border bg-muted/40 p-4"
      >
        <DraftPreviewFrame
          draftId={draftId}
          manifest={manifest}
          format={format}
          theme={theme}
          available={available}
        />
      </div>
    </div>
  );
}
