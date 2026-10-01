import { type ComponentFormat, FORMAT_SIZES } from "@kibo/schema";
import { cellMetrics, spanLength } from "./format-grid";

export const formatBox = (format: ComponentFormat, width: number): { width: number; height: number } => {
  const m = cellMetrics(width);
  const { w, h } = FORMAT_SIZES[format];
  return { width: spanLength(w, m.column, m.gap), height: spanLength(h, m.row, m.gap) };
};
