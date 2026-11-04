const channels = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (rgb: readonly number[]): string =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const linear = (v: number): number => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

export const isHex = (value: string): boolean => /^#[0-9a-fA-F]{6}$/.test(value);

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

export function mix(a: string, b: string, weight: number): string {
  const [x, y] = [channels(a), channels(b)];
  return toHex(x.map((v, i) => v * weight + (y[i] ?? 0) * (1 - weight)));
}

const lowest = (color: string, surfaces: readonly string[]): number =>
  Math.min(...surfaces.map((s) => contrast(color, s)));

const STEPS = 50;

function towards(color: string, target: string, surfaces: readonly string[], min: number): string | null {
  for (let step = 0; step <= STEPS; step++) {
    const candidate = mix(target, color, step / STEPS);
    if (lowest(candidate, surfaces) >= min) return candidate;
  }
  return null;
}

export function ensureContrast(color: string, surfaces: readonly string[], min: number): string {
  if (lowest(color, surfaces) >= min) return color;
  const candidates = ["#FFFFFF", "#000000"]
    .map((target) => towards(color, target, surfaces, min))
    .filter((c): c is string => c !== null)
    .sort((a, b) => contrast(a, color) - contrast(b, color));
  return candidates[0] ?? (lowest("#FFFFFF", surfaces) > lowest("#000000", surfaces) ? "#FFFFFF" : "#000000");
}

export const bestOn = (fills: readonly string[]): string =>
  lowest("#FFFFFF", fills) >= lowest("#09090B", fills) ? "#FFFFFF" : "#09090B";
