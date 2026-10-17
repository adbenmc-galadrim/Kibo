import type { Box } from "./pixel-report";

export type PixelMask = Box & { why: string };
export type MaskedScreen = "planning" | "fonctionnalite" | "tickets";

export const MASK_COLOR = "#FF00FF";
export const MASK_RGB: readonly [number, number, number] = [255, 0, 255];
export const MASK_AREA_LIMIT = 0.08;

const USER: PixelMask = {
  x: 16,
  y: 956,
  w: 140,
  h: 24,
  why: "avatar et nom de l'utilisateur : la phase 25 affiche le compte du système",
};
export const PROJECT_PAGES_SHIFT = 32;
export const PROJECT_PAGES_ZONE: Box = { x: 10, y: 256, w: 220, h: 320 };

const ROW_STEP = 32;
const FIRST_ROW_BOX = 258;
const ROW_BOX = 30;
const SHIFTED_ROWS = 9;
const SHIFT_WHY =
  "page Vue d'ensemble du projet, phase 26 : les lignes suivantes remontent de 32 px et sont comparées décalées";

export function projectRows(activeRow: number): PixelMask[] {
  const text = Array.from({ length: SHIFTED_ROWS }, (_, k) => ({
    x: PROJECT_PAGES_ZONE.x,
    y: FIRST_ROW_BOX + 6 + k * ROW_STEP,
    w: PROJECT_PAGES_ZONE.w,
    h: 18,
    why: SHIFT_WHY,
  }));
  const active = {
    x: PROJECT_PAGES_ZONE.x,
    y: FIRST_ROW_BOX + (activeRow - 1) * ROW_STEP,
    w: PROJECT_PAGES_ZONE.w,
    h: ROW_BOX + ROW_STEP,
    why: `${SHIFT_WHY} (fond de la page active, à sa place et décalé)`,
  };
  return [...text, active];
}

const syncAge = (x: number): PixelMask => ({
  x,
  y: 16,
  w: 133,
  h: 16,
  why: "« Synchronisé · il y a 1 min » : âge relatif de la synchronisation, aucun serveur de sync semé",
});
const sessionSlot = (y: number, key: string): PixelMask => ({
  x: 589,
  y,
  w: 95,
  h: 16,
  why: `session T3 Code sur ${key} (point orange) : la phase 25 écrit « suivante : … » à cet emplacement`,
});
const updatedAt = (y: number, w: number): PixelMask => ({
  x: 1323,
  y,
  w,
  h: 17,
  why: "« Mis à jour » : âge relatif, aucun horodatage de ticket en phase 25",
});

export const PIXEL_MASKS: Record<MaskedScreen, readonly PixelMask[]> = {
  planning: [USER, ...projectRows(1), syncAge(987), sessionSlot(369, "EMIS-45"), sessionSlot(494, "EMIS-33")],
  fonctionnalite: [
    USER,
    ...projectRows(1),
    syncAge(1124),
    {
      x: 543,
      y: 560,
      w: 169,
      h: 22,
      why: "pastille « session · T3 Code · 42 min » : hook d'activité de la phase 26",
    },
    { x: 453, y: 385, w: 54, h: 15, why: "« hier 18:22 » de la PR #19 : aucune commande ne date une PR" },
    { x: 393, y: 485, w: 32, h: 15, why: "« 15:04 » de la PR #22 : aucune commande ne date une PR" },
    {
      x: 506,
      y: 588,
      w: 29,
      h: 15,
      why: "« 14:51 » de la branche : l'étape de livraison est datée par le démon",
    },
    {
      x: 1268,
      y: 181,
      w: 104,
      h: 15,
      why: "« proposé par l'agent » : report proposé par l'agent en phase 26",
    },
    { x: 1178, y: 413, w: 26, h: 14, why: "« hier » de Q16 : la date d'une question est posée par le démon" },
    { x: 1093, y: 491, w: 318, h: 88, why: "lignes du journal d'activité : journal de suivi de la phase 26" },
  ],
  tickets: [
    USER,
    ...projectRows(2),
    syncAge(1124),
    {
      x: 980,
      y: 231,
      w: 154,
      h: 16,
      why: "« changements demandés » et CI rouge de la PR #20 : review et CI en phase 26",
    },
    { x: 980, y: 273, w: 14, h: 14, why: "coche de CI de la PR #22 : CI non semable" },
    { x: 509, y: 191, w: 14, h: 14, why: "point de session d'EMIS-33 : sessions T3 Code, phase 26" },
    { x: 471, y: 232, w: 14, h: 14, why: "point de session d'EMIS-45 : sessions T3 Code, phase 26" },
    { x: 1040, y: 511, w: 14, h: 14, why: "coche de CI de la PR #19 : CI non semable" },
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
};

const isMaskedScreen = (screen: string): screen is MaskedScreen => Object.hasOwn(PIXEL_MASKS, screen);

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
