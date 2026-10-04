import {
  type ComponentFormat,
  type ComponentManifest,
  compactLayouts,
  FORMAT_SIZES,
  type FormatSize,
  formatsOf,
  GRID_COLUMNS,
  type Layout,
  sizeLimitsOf,
} from "@kibo/schema";
import { type CellMetrics, dropTarget } from "../lib/format-grid";

export type Draft = ReadonlyMap<string, Layout>;
export type Preview = { layouts: Draft; landing: Layout };

export const sameLayout = (a: Layout, b: Layout): boolean =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

export const compactDraft = (layouts: Draft, first: readonly string[] = []): Draft =>
  compactLayouts(
    [...layouts].map(([id, layout]) => ({ id, layout })),
    first,
  );

const preview = (layouts: Draft, id: string, layout: Layout): Preview => {
  const compacted = compactDraft(new Map(layouts).set(id, layout), [id]);
  return { layouts: compacted, landing: compacted.get(id) ?? layout };
};

export function previewMove(
  layouts: Draft,
  id: string,
  delta: { x: number; y: number },
  m: CellMetrics,
): Preview | null {
  const current = layouts.get(id);
  return current ? preview(layouts, id, dropTarget(current, delta, m)) : null;
}

export function previewSize(layouts: Draft, id: string, size: FormatSize): Preview | null {
  const current = layouts.get(id);
  if (!current) return null;
  const x = Math.min(current.x, Math.max(0, GRID_COLUMNS - size.w));
  return preview(layouts, id, { x, y: current.y, w: size.w, h: size.h });
}

export function displayedLayouts(saved: Draft, edits: Draft): Draft {
  const kept = [...edits].filter(([id]) => saved.has(id));
  if (kept.length === 0) return saved;
  return compactDraft(
    new Map([...saved, ...kept]),
    kept.map(([id]) => id),
  );
}

export const heldPreview = (preview: Draft, id: string, layouts: Draft): Draft => {
  const held = layouts.get(id);
  return held ? new Map(preview).set(id, held) : preview;
};

export const editsOf = (saved: Draft, preview: Preview): Draft =>
  new Map(
    [...preview.layouts].filter(([id, layout]) => {
      const before = saved.get(id);
      return !before || !sameLayout(before, layout);
    }),
  );

export function changedIds(origin: Draft, draft: Draft): string[] {
  return [...draft]
    .filter(([id, l]) => {
      const before = origin.get(id);
      return !before || !sameLayout(before, l);
    })
    .sort(([a, la], [b, lb]) => la.y - lb.y || la.x - lb.x || (a < b ? -1 : a > b ? 1 : 0))
    .map(([id]) => id);
}

export function shortcutFormats(
  manifest: Pick<ComponentManifest, "kind" | "formats" | "size">,
): ComponentFormat[] {
  const { min, max } = sizeLimitsOf(manifest);
  return formatsOf(manifest).filter((f) => {
    const { w, h } = FORMAT_SIZES[f];
    return w >= min.w && h >= min.h && w <= max.w && h <= max.h;
  });
}
