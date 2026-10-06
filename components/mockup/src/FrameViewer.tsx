import type { DesignFrame } from "@kibo/schema";
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

type Props = { frame: DesignFrame; fit: "contain" | "width" };
type Frame = { fitted: Size; box: Size };

const NONE: Size = { width: 0, height: 0 };
const CENTER: Point = { x: 0, y: 0 };

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

function applied(state: ZoomState, action: ZoomAction, focus: Point, { fitted, box }: Frame): ZoomState {
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

export function FrameViewer({ frame, fit }: Props) {
  const box = useRef<HTMLFieldSetElement>(null);
  const boxSize = useBoxSize(box);
  const [image, setImage] = useState<Size>({ width: frame.width ?? 0, height: frame.height ?? 0 });
  const [zoom, setZoom] = useState<ZoomState>(FITTED);
  const [dragFrom, setDragFrom] = useState<Point | null>(null);
  const fitted = fittedSize(image, boxSize, fit);
  const geometry = useRef<Frame>({ fitted, box: boxSize });
  geometry.current = { fitted, box: boxSize };
  const pannable = isPannable(zoom, fitted, boxSize);
  const pannableRef = useRef(pannable);
  pannableRef.current = pannable;

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

  return (
    <fieldset
      ref={box}
      aria-label={fr.viewer(frame.name)}
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
      <div className="absolute inset-0 grid place-items-center">
        <img
          src={frame.url}
          alt={frame.name}
          crossOrigin="anonymous"
          decoding="async"
          draggable={false}
          onLoad={(e) =>
            setImage({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
          }
          className="max-w-none shadow-sm"
          style={{
            width: fitted.width,
            height: fitted.height,
            transform: `translate(${zoom.pan.x}px, ${zoom.pan.y}px) scale(${zoom.scale})`,
          }}
        />
      </div>
      <ZoomToolbar zoom={zoom} onAction={act} />
    </fieldset>
  );
}
