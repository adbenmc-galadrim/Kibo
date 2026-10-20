import type { Box } from "./pixel-report";

export type PixelMask = Box & { why: string };
type OriginScreen =
  | "planning"
  | "fonctionnalite"
  | "tickets"
  | "vue-ensemble"
  | "graphe"
  | "graphe-prs"
  | "apercu-maquette"
  | "nouveau-projet"
  | "kanban"
  | "fiche-ticket"
  | "questions";

export const ATTENTE_SCREENS = [
  "attente-vue-ensemble",
  "attente-planning",
  "attente-fonctionnalite",
  "attente-kanban",
  "attente-fiche-ticket",
] as const;
type AttenteScreen = (typeof ATTENTE_SCREENS)[number];
export type MaskedScreen = OriginScreen | AttenteScreen;

export const ATTENTE_ORIGINS: Record<AttenteScreen, OriginScreen> = {
  "attente-vue-ensemble": "vue-ensemble",
  "attente-planning": "planning",
  "attente-fonctionnalite": "fonctionnalite",
  "attente-kanban": "kanban",
  "attente-fiche-ticket": "fiche-ticket",
};

export const MASK_COLOR = "#FF00FF";
export const MASK_RGB: readonly [number, number, number] = [255, 0, 255];
export const MASK_AREA_LIMIT = 0.04;

const ORIGIN_HEIGHTS: Record<OriginScreen, number> = {
  planning: 1000,
  fonctionnalite: 1000,
  tickets: 1000,
  "vue-ensemble": 1260,
  graphe: 1000,
  "graphe-prs": 1000,
  "apercu-maquette": 1000,
  "nouveau-projet": 1000,
  kanban: 1000,
  "fiche-ticket": 1000,
  questions: 1000,
};

export const PIXEL_HEIGHTS: Record<MaskedScreen, number> = {
  ...ORIGIN_HEIGHTS,
  "attente-vue-ensemble": ORIGIN_HEIGHTS["vue-ensemble"],
  "attente-planning": ORIGIN_HEIGHTS.planning,
  "attente-fonctionnalite": ORIGIN_HEIGHTS.fonctionnalite,
  "attente-kanban": ORIGIN_HEIGHTS.kanban,
  "attente-fiche-ticket": ORIGIN_HEIGHTS["fiche-ticket"],
};

const DIALOGS = {
  "nouveau-projet": { x: 460, y: 170, w: 520, h: 660 },
  "fiche-ticket": { x: 904, y: 189, w: 512, h: 36 },
  questions: { x: 854, y: 94, w: 420, h: 250 },
};

export const DIALOG_SCREENS: Partial<Record<MaskedScreen, Box>> = {
  ...DIALOGS,
  "attente-fiche-ticket": DIALOGS["fiche-ticket"],
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

const ORIGIN_MASKS: Record<OriginScreen, readonly PixelMask[]> = {
  planning: [USER, syncAge(987)],
  fonctionnalite: [
    USER,
    syncAge(1124),
    clockTime(665, 563, 40, 16, "« 42 min », durée en cours de SILO-33 sur la fiche"),
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
    clockTime(1018, 251, 42, 16, "« 42 min », durée en cours de SILO-33"),
    clockTime(1021, 288, 38, 16, "« 18 min », durée en cours de SILO-45"),
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
  "graphe-prs": [USER, syncAge(1124)],
  "apercu-maquette": [],
  "nouveau-projet": [],
  kanban: [],
  "fiche-ticket": [],
  questions: [],
};

const ACTIVITY_HOURS = ["15:04", "14:51", "14:40", "14:36"];

const ATTENTE_VUE_MASKS: readonly PixelMask[] = [
  ...ORIGIN_MASKS["vue-ensemble"].filter((m) => !/de l'activité|de Q1[467]/.test(m.why)),
  ...ACTIVITY_HOURS.map((hour, i) => clockTime(279, 1072 + 39 * i, 40, 16, `« ${hour} » de l'activité`)),
  clockTime(906, 1088, 137, 21, "« il y a 3 j » de Q14 et la puce « bloquante » que sa largeur déplace"),
  clockTime(912, 1151, 62, 17, "« hier » de Q16"),
  clockTime(903, 1212, 63, 17, "« il y a 2 h » de Q17"),
];

const ATTENTE_FEATURE_MASKS: readonly PixelMask[] = [
  USER,
  syncAge(1124),
  clockTime(453, 385, 54, 15, "« hier 18:22 » de la PR #19"),
  clockTime(393, 485, 32, 15, "« 15:04 » de la PR #22"),
  clockTime(1178, 392, 26, 14, "« hier » de Q16"),
  clockTime(1364, 477, 36, 15, "« 15:04 » de l'activité"),
  clockTime(1364, 507, 36, 15, "« 14:51 » de l'activité"),
  clockTime(1376, 537, 24, 15, "« hier » de l'activité"),
];

export const PIXEL_MASKS: Record<MaskedScreen, readonly PixelMask[]> = {
  ...ORIGIN_MASKS,
  "attente-vue-ensemble": ATTENTE_VUE_MASKS,
  "attente-planning": ORIGIN_MASKS.planning,
  "attente-fonctionnalite": ATTENTE_FEATURE_MASKS,
  "attente-kanban": ORIGIN_MASKS.kanban,
  "attente-fiche-ticket": ORIGIN_MASKS["fiche-ticket"],
};

const isMaskedScreen = (screen: string): screen is MaskedScreen => Object.hasOwn(PIXEL_MASKS, screen);

const REFERENCE_FILES: Partial<Record<string, string>> = {
  "vue-ensemble": "vue-ensemble-v3",
  graphe: "graphe-fonctionnalites",
  "attente-vue-ensemble": "attente-vue-ensemble",
};

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
