export type MarkMode = "dark" | "light" | "auto";
export type MarkCard = { x: number; y: number; w: number; h: number; fill: "ink" | "brand"; opacity: number };

export const BRAND = "#F97316";
export const CARD_RADIUS = 4;

const CARDS: readonly MarkCard[] = [
  { x: 22, y: 24, w: 16, h: 22, fill: "ink", opacity: 1 },
  { x: 22, y: 52, w: 16, h: 16, fill: "ink", opacity: 0.45 },
  { x: 42, y: 24, w: 16, h: 16, fill: "ink", opacity: 1 },
  { x: 42, y: 46, w: 16, h: 30, fill: "brand", opacity: 1 },
  { x: 62, y: 24, w: 16, h: 12, fill: "ink", opacity: 0.45 },
];

export const KIBO_MARK = {
  tile: { x: 2, y: 2, size: 96, radius: 24, stroke: 2 },
  cards: CARDS,
};

type Palette = { ink: string; base: string; edge: string };
const DARK: Palette = { ink: "#FAFAFA", base: "#18181B", edge: "#27272A" };
const LIGHT: Palette = { ink: "#09090B", base: "#FFFFFF", edge: "#E4E4E7" };

const DARK_SCHEME_STYLE = `<style>@media (prefers-color-scheme: dark){.tile{fill:${DARK.base};stroke:${DARK.edge}}.ink{fill:${DARK.ink}}}</style>`;

export function kiboMarkSvg(mode: MarkMode, size: number, art: number = size): string {
  const unit = art / 100;
  const offset = (size - art) / 2;
  const n = (v: number) => Number((v * unit).toFixed(2));
  const at = (v: number) => Number((v * unit + offset).toFixed(2));
  const palette = mode === "dark" ? DARK : LIGHT;
  const classed = mode === "auto";
  const cls = (name: string) => (classed ? `class="${name}" ` : "");
  const { tile, cards } = KIBO_MARK;
  const tileSvg =
    `<rect ${cls("tile")}x="${at(tile.x)}" y="${at(tile.y)}" width="${n(tile.size)}" height="${n(tile.size)}" rx="${n(tile.radius)}" ` +
    `fill="${palette.base}" stroke="${palette.edge}" stroke-width="${Math.max(1, n(tile.stroke))}"/>`;
  const cardSvg = cards
    .map((c) => {
      const fill = c.fill === "brand" ? BRAND : palette.ink;
      const klass = c.fill === "brand" ? "" : cls("ink");
      return `<rect ${klass}x="${at(c.x)}" y="${at(c.y)}" width="${n(c.w)}" height="${n(c.h)}" rx="${n(CARD_RADIUS)}" fill="${fill}" opacity="${c.opacity}"/>`;
    })
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">` +
    (classed ? DARK_SCHEME_STYLE : "") +
    tileSvg +
    cardSvg +
    "</svg>"
  );
}
