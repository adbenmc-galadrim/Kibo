import { tmpdir } from "node:os";
import { join } from "node:path";

export const FIXED_NOW = "2026-10-16T14:52:00+02:00";
export const EMIS_MAQUETTES = "emis-maquettes";
export const PIXEL_WIDTH = 1440;
export const REFERENCES_TEMPLATE = "{testDir}/../design/redesign/exports/{arg}{ext}";
export const PIXEL_KIT_REFERENCES = join(tmpdir(), "kibo-pixel-kit");
export const PIXEL_SCREENSHOT = {
  maxDiffPixelRatio: 0.02,
  threshold: 0.3,
  animations: "disabled",
  caret: "hide",
} as const;

export function assertFixedNow(info: unknown): void {
  if (typeof info !== "object" || info === null) throw new Error("getAppInfo returned no object");
  const fixedNow = "fixedNow" in info ? info.fixedNow : undefined;
  if (typeof fixedNow === "string" && Date.parse(fixedNow) === Date.parse(FIXED_NOW)) return;
  throw new Error(`daemon clock must be frozen with KIBO_FIXED_NOW=${FIXED_NOW}, got ${String(fixedNow)}`);
}
