import type { ComponentManifestInput, Template } from "@kibo/schema";
import { BLANK_UI } from "./blank";
import { CHART_UI } from "./chart";
import { GAME_UI } from "./game";
import { TABLE_UI } from "./table";
import { THREE_UI } from "./three";

export type TemplateSpec = { ui: (title: string) => string; manifest: Partial<ComponentManifestInput> };

export const TEMPLATES: Record<Template, TemplateSpec> = {
  blank: { ui: BLANK_UI, manifest: {} },
  "3d": {
    ui: THREE_UI,
    manifest: {
      capabilities: ["webgl", "assets"],
      configSchema: {
        model: { type: "string", nullable: true, default: null, asset: "model", label: "Modèle (.glb)" },
      },
    },
  },
  game: { ui: GAME_UI, manifest: { capabilities: ["fullscreen", "gamepad"], data: true } },
  chart: { ui: CHART_UI, manifest: { reads: ["ticket", "status"] } },
  table: { ui: TABLE_UI, manifest: { reads: ["ticket", "status"] } },
};
