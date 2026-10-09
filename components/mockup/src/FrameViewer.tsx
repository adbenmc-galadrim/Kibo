import { isHtmlFrame } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CompareMode } from "./compare";
import { FrameSurface, type Surface } from "./FrameSurface";
import { fr } from "./fr";
import { ZoomToolbar } from "./ZoomToolbar";
import {
  clampPan,
  doubleClick,
  FITTED,
  fittedSize,
  isPannable,
  keyAction,
  type Point,
  panBy,
  type Size,
  wheelAction,
  type ZoomAction,
  type ZoomState,
  zoomAt,
} from "./zoom";

type Props = {
  surfaces: readonly Surface[];
  size: Size | null;
  mode: CompareMode | null;
  fit: "contain" | "width";
  name: string;
};
type Geometry = { fitted: Size; box: Size };

const NONE: Size = { width: 0, height: 0 };
const CENTER: Point = { x: 0, y: 0 };
const SIDE_GAP = 8;

function useBoxSize(box: RefObject<HTMLFieldSetElement | null>): Size {
  const [size, setSize] = useState<Size>(NONE);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [box]);
  return size;
}

function applied(state: ZoomState, action: ZoomAction, focus: Point, { fitted, box }: Geometry): ZoomState {
  if (action.kind === "zoom") return clampPan(zoomAt(state, action.factor, focus), fitted, box);
  if (action.kind === "pan") return clampPan(panBy(state, action.dx, action.dy), fitted, box);
  if (action.kind === "fit") return FITTED;
  return state;
}

function focusIn(el: Element | null, e: { clientX: number; clientY: number }): Point {
  if (!el) return CENTER;
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
}

const cellOf = (box: Size, mode: CompareMode | null): Size =>
  mode === "side" ? { width: Math.max(0, (box.width - SIDE_GAP) / 2), height: box.height } : box;

function contentSize(surfaces: readonly Surface[], size: Size | null, natural: Size, cell: Size): Size {
  if (size) return size;
  return surfaces.some((s) => !isHtmlFrame(s.frame)) ? natural : cell;
}

const displayed = (zoom: ZoomState, content: Size, fitted: Size): ZoomState => ({
  ...zoom,
  scale: content.width > 0 && fitted.width > 0 ? (zoom.scale * fitted.width) / content.width : zoom.scale,
});

export function FrameViewer({ surfaces, size, mode, fit, name }: Props) {
  const box = useRef<HTMLFieldSetElement>(null);
  const boxSize = useBoxSize(box);
  const [natural, setNatural] = useState<Size>(NONE);
  const [zoom, setZoom] = useState<ZoomState>(FITTED);
  const [dragFrom, setDragFrom] = useState<Point | null>(null);
  const cell = cellOf(boxSize, mode);
  const content = contentSize(surfaces, size, natural, cell);
  const fitted = fittedSize(content, cell, fit);
  const geometry = useRef<Geometry>({ fitted, box: cell });
  geometry.current = { fitted, box: cell };
  const pannable = isPannable(zoom, fitted, cell);
  const pannableRef = useRef(pannable);
  pannableRef.current = pannable;
  const shown = displayed(zoom, content, fitted);

  const act = (action: ZoomAction, focus: Point = CENTER) =>
    setZoom((z) => applied(z, action, focus, geometry.current));

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const action = wheelAction(e, pannableRef.current);
      if (action.kind === "none") return;
      e.preventDefault();
      const focus = focusIn(el, e);
      setZoom((z) => applied(z, action, focus, geometry.current));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLFieldSetElement>) => {
    if (e.button !== 0 || !pannable || e.target instanceof HTMLButtonElement) return;
    setDragFrom({ x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLFieldSetElement>) => {
    if (!dragFrom) return;
    act({ kind: "pan", dx: e.clientX - dragFrom.x, dy: e.clientY - dragFrom.y });
    setDragFrom({ x: e.clientX, y: e.clientY });
  };
  const onPointerUp = () => setDragFrom(null);
  const onDoubleClick = (e: MouseEvent<HTMLFieldSetElement>) => {
    if (e.target instanceof Element && e.target.closest('[role="toolbar"]')) return;
    const focus = focusIn(box.current, e);
    setZoom((z) => clampPan(doubleClick(z, focus), geometry.current.fitted, geometry.current.box));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLFieldSetElement>) => {
    const action = keyAction(e);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    act(action);
  };

  const surface = (s: Surface) => (
    <FrameSurface key={s.frame.id} surface={s} size={content} zoom={shown} onNaturalSize={setNatural} />
  );

  return (
    <fieldset
      ref={box}
      aria-label={fr.viewer(name)}
      tabIndex={-1}
      data-dragging={dragFrom !== null}
      className={cn(
        "relative m-0 min-h-0 min-w-0 flex-1 touch-none select-none overflow-hidden border-0 bg-muted p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pannable && "cursor-grab data-[dragging=true]:cursor-grabbing",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      {mode === "side" ? (
        <div className="absolute inset-0 grid grid-cols-2" style={{ gap: SIDE_GAP }}>
          {surfaces.map((s) => (
            <div key={s.frame.id} className="relative overflow-hidden">
              {surface(s)}
            </div>
          ))}
        </div>
      ) : (
        <div className="absolute inset-0">{surfaces.map(surface)}</div>
      )}
      <ZoomToolbar zoom={zoom} onAction={act} />
    </fieldset>
  );
}
