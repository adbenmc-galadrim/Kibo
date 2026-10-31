import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXED_NOW = "2026-10-16T14:52:00+02:00";
export const SILO_MAQUETTES = "silo-maquettes";
export const SILO_ATTENTE = "silo-attente";
export const SILO_PRS = "silo-prs";
export const SILO_APERCU = "silo-apercu";
export const SILO_GRAPHE = "silo-graphe";
export const SILO_T3 = "silo-t3";
const SILO_SCENARIOS: readonly string[] = [
  SILO_MAQUETTES,
  SILO_ATTENTE,
  SILO_PRS,
  SILO_APERCU,
  SILO_GRAPHE,
  SILO_T3,
];
export const isSiloScenario = (scenario: string): boolean => SILO_SCENARIOS.includes(scenario);
export const PIXEL_WIDTH = 1440;
export const DESIGN_REFERENCES = fileURLToPath(new URL("../design/redesign/exports", import.meta.url));
export const PIXEL_KIT_REFERENCES = join(tmpdir(), "kibo-pixel-kit");
export const COMPARED_REFERENCES = join(tmpdir(), "kibo-pixel-compared");
export const REFERENCES_TEMPLATE = `${COMPARED_REFERENCES}/{projectName}/{arg}{ext}`;
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
