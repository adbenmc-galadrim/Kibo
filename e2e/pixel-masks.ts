import type { Box } from "./pixel-report";

export type PixelMask = Box & { why: string };
export type MaskedScreen = "planning" | "fonctionnalite" | "tickets" | "vue-ensemble" | "graphe";

export const MASK_COLOR = "#FF00FF";
export const MASK_RGB: readonly [number, number, number] = [255, 0, 255];
export const MASK_AREA_LIMIT = 0.04;

export const PIXEL_HEIGHTS: Record<MaskedScreen, number> = {
  planning: 1000,
  fonctionnalite: 1000,
  tickets: 1000,
  "vue-ensemble": 1260,
  graphe: 1000,
};

const user = (y: number): PixelMask => ({
  x: 16,
  y,
  w: 140,
  h: 24,
  why: "avatar et nom de l'utilisateur : le démon affiche le compte du système",
});
const USER = user(956);

const syncAge = (x: number): PixelMask => ({
  x,
  y: 16,
  w: 133,
  h: 16,
  why: "« Synchronisé · il y a 1 min » : âge relatif de la synchronisation, aucun serveur de sync semé",
});
const updatedAt = (y: number, w: number): PixelMask => ({
  x: 1323,
  y,
  w,
  h: 17,
  why: "« Mis à jour » : âge relatif d'un fait semé à l'heure réelle (§37.15 point 13)",
});
const clockTime = (x: number, y: number, w: number, h: number, what: string): PixelMask => ({
  x,
  y,
  w,
  h,
  why: `${what} : heure réelle d'un fait semé sous l'horloge figée (§37.15 point 13)`,
});

export const PIXEL_MASKS: Record<MaskedScreen, readonly PixelMask[]> = {
  planning: [USER, syncAge(987)],
  fonctionnalite: [
    USER,
    syncAge(1124),
    clockTime(665, 563, 40, 16, "« 42 min », durée en cours d'EMIS-33 sur la fiche"),
    clockTime(453, 385, 54, 15, "« hier 18:22 » de la PR #19"),
    clockTime(393, 485, 32, 15, "« 15:04 » de la PR #22"),
    clockTime(506, 588, 29, 15, "« 14:51 » de la branche"),
    clockTime(1178, 413, 26, 14, "« hier » de Q16"),
    clockTime(1364, 498, 36, 15, "« 15:04 » de l'activité"),
    clockTime(1364, 528, 36, 15, "« 14:51 » de l'activité"),
    clockTime(1376, 558, 24, 15, "« hier » de l'activité"),
  ],
  tickets: [
    USER,
    syncAge(1124),
    updatedAt(190, 61),
    updatedAt(231, 66),
    updatedAt(272, 45),
    updatedAt(313, 23),
    updatedAt(354, 23),
    updatedAt(395, 22),
    updatedAt(469, 48),
    updatedAt(510, 23),
    updatedAt(551, 26),
    updatedAt(592, 26),
  ],
  "vue-ensemble": [
    user(1216),
    syncAge(671),
    clockTime(1225, 30, 62, 17, "« il y a 4 min », âge du dernier tour de suivi"),
    clockTime(1018, 251, 42, 16, "« 42 min », durée en cours d'EMIS-33"),
    clockTime(1021, 288, 38, 16, "« 18 min », durée en cours d'EMIS-45"),
    clockTime(279, 1074, 40, 16, "« 15:04 » de l'activité"),
    clockTime(279, 1113, 40, 16, "« 14:51 » de l'activité"),
    clockTime(279, 1152, 40, 16, "« 14:40 » de l'activité"),
    clockTime(279, 1191, 40, 16, "« 14:36 » de l'activité"),
    clockTime(906, 983, 137, 21, "« il y a 3 j » de Q14 et la puce « bloquante » que sa largeur déplace"),
    clockTime(912, 1045, 62, 17, "« hier » de Q16"),
    clockTime(903, 1124, 63, 17, "« il y a 2 h » de Q17"),
    {
      x: 938,
      y: 389,
      w: 66,
      h: 16,
      why: "« S45 2 nov. » : la maquette nomme la quatrième semaine d'un sprint que la fixture ne sème pas",
    },
  ],
  graphe: [
    USER,
    syncAge(1124),
    {
      x: 1134,
      y: 64,
      w: 291,
      h: 16,
      why: "compteur des dépendances : la maquette compte 13 liens d'étapes que la fixture ne sème pas",
    },
  ],
};

const isMaskedScreen = (screen: string): screen is MaskedScreen => Object.hasOwn(PIXEL_MASKS, screen);

const REFERENCE_FILES: Partial<Record<string, string>> = { "vue-ensemble": "vue-ensemble-v2" };

export const referenceOf = (screen: string): string => REFERENCE_FILES[screen] ?? screen;

export const masksOf = (screen: string): readonly PixelMask[] =>
  isMaskedScreen(screen) ? PIXEL_MASKS[screen] : [];

export const outside = (m: Box, width: number, height: number): boolean =>
  m.x < 0 || m.y < 0 || m.w <= 0 || m.h <= 0 || m.x + m.w > width || m.y + m.h > height;

export function maskedRatio(masks: readonly Box[], width: number, height: number): number {
  const covered = new Uint8Array(width * height);
  for (const m of masks)
    for (let y = Math.max(0, m.y); y < Math.min(height, m.y + m.h); y++)
      covered.fill(1, y * width + Math.max(0, m.x), y * width + Math.min(width, m.x + m.w));
  return covered.reduce((n, c) => n + c, 0) / (width * height);
}
