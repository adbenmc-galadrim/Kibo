import { Color, SRGBColorSpace } from "three";

export type ThemeColors = { background: Color; foreground: Color; muted: Color };
export const ZINC_FALLBACK = {
  dark: { background: 0x18181b, foreground: 0xfafafa, muted: 0x27272a },
  light: { background: 0xffffff, foreground: 0x09090b, muted: 0xf4f4f5 },
} as const;

export function parseCssColor(
  css: string,
  probe: CanvasRenderingContext2D | null,
): [number, number, number] | null {
  if (!probe || css.trim() === "") return null;
  probe.fillStyle = "#000";
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return r === undefined || g === undefined || b === undefined ? null : [r, g, b];
}

export function probeContext(doc: Document = document): CanvasRenderingContext2D | null {
  const canvas = doc.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.getContext("2d", { willReadFrequently: true });
}

const rgb = (parts: [number, number, number]) =>
  new Color().setRGB(parts[0] / 255, parts[1] / 255, parts[2] / 255, SRGBColorSpace);

export function themeColors(
  root: Element = document.documentElement,
  probe: CanvasRenderingContext2D | null = probeContext(),
  dark: boolean = root.classList.contains("dark"),
): ThemeColors {
  const fallback = dark ? ZINC_FALLBACK.dark : ZINC_FALLBACK.light;
  const style = getComputedStyle(root);
  const read = (name: string, backup: number) => {
    const parsed = parseCssColor(style.getPropertyValue(name), probe);
    return parsed ? rgb(parsed) : new Color(backup);
  };
  return {
    background: read("--card", fallback.background),
    foreground: read("--foreground", fallback.foreground),
    muted: read("--muted", fallback.muted),
  };
}
