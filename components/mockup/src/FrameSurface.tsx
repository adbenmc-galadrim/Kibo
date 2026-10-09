import { type DesignFrame, EMBED_ATTRIBUTES, EMBED_TTL_MS, type EmbedView, isHtmlFrame } from "@kibo/schema";
import { EmbedFrame } from "@kibo/sdk";
import type { CSSProperties } from "react";
import type { Size, ZoomState } from "./zoom";

export type Surface = {
  frame: DesignFrame;
  interactive: boolean;
  opacity?: number;
  clip?: string;
  onExpired?(): void;
};

type Props = { surface: Surface; size: Size; zoom: ZoomState; onNaturalSize?(size: Size): void };

export const storyView = (frame: DesignFrame): EmbedView => ({
  url: frame.url,
  kind: "storybook",
  ...EMBED_ATTRIBUTES.storybook,
  expiresAt: frame.fetchedAt + EMBED_TTL_MS,
  target: frame.source,
});

export function FrameSurface({ surface, size, zoom, onNaturalSize }: Props) {
  const { frame } = surface;
  const style: CSSProperties = {
    width: size.width,
    height: size.height,
    transform: `translate(-50%, -50%) translate(${zoom.pan.x}px, ${zoom.pan.y}px) scale(${zoom.scale})`,
    opacity: surface.opacity,
    clipPath: surface.clip,
    pointerEvents: surface.interactive ? undefined : "none",
  };
  return (
    <div className="absolute top-1/2 left-1/2 max-w-none shadow-sm" style={style}>
      {isHtmlFrame(frame) ? (
        <EmbedFrame view={storyView(frame)} title={frame.name} onExpired={surface.onExpired} />
      ) : (
        <img
          src={frame.url}
          alt={frame.name}
          crossOrigin="anonymous"
          decoding="async"
          draggable={false}
          onLoad={(e) =>
            onNaturalSize?.({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
          }
          className="block h-full w-full max-w-none"
        />
      )}
    </div>
  );
}
