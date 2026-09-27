import { expect, test } from "bun:test";
import { KIBO_MARK, kiboMarkSvg } from "./kibo-mark";

const PENPOT_DARK_100 =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="none">' +
  '<rect x="2" y="2" width="96" height="96" rx="24" fill="#18181B" stroke="#27272A" stroke-width="2"/>' +
  '<rect x="22" y="24" width="16" height="22" rx="4" fill="#FAFAFA" opacity="1"/>' +
  '<rect x="22" y="52" width="16" height="16" rx="4" fill="#FAFAFA" opacity="0.45"/>' +
  '<rect x="42" y="24" width="16" height="16" rx="4" fill="#FAFAFA" opacity="1"/>' +
  '<rect x="42" y="46" width="16" height="30" rx="4" fill="#F97316" opacity="1"/>' +
  '<rect x="62" y="24" width="16" height="12" rx="4" fill="#FAFAFA" opacity="0.45"/>' +
  "</svg>";

test("the dark mark at 100 is byte for byte the Penpot kanbanLogo", () => {
  expect(kiboMarkSvg("dark", 100)).toBe(PENPOT_DARK_100);
});

test("the light mark swaps only the palette", () => {
  const light = kiboMarkSvg("light", 100);
  expect(light).toBe(
    PENPOT_DARK_100.replaceAll("#18181B", "#FFFFFF")
      .replaceAll("#27272A", "#E4E4E7")
      .replaceAll("#FAFAFA", "#09090B"),
  );
});

test("the mark scales with two decimals like the Penpot script", () => {
  const svg = kiboMarkSvg("light", 1024);
  expect(svg).toContain('width="1024" height="1024" viewBox="0 0 1024 1024"');
  expect(svg).toContain('<rect x="20.48" y="20.48" width="983.04" height="983.04" rx="245.76"');
  expect(svg).toContain('stroke-width="20.48"');
  expect(svg).toContain(
    '<rect x="430.08" y="471.04" width="163.84" height="307.2" rx="40.96" fill="#F97316"',
  );
});

test("the auto mark is light by default and follows the dark scheme by CSS", () => {
  const svg = kiboMarkSvg("auto", 64);
  expect(svg).toContain(
    '<rect class="tile" x="1.28" y="1.28" width="61.44" height="61.44" rx="15.36" fill="#FFFFFF" stroke="#E4E4E7"',
  );
  expect(svg).toContain('<rect class="ink" x="14.08" y="15.36"');
  expect(svg).toContain("@media (prefers-color-scheme: dark)");
  expect(svg).toContain(".tile{fill:#18181B;stroke:#27272A}");
  expect(svg).toContain(".ink{fill:#FAFAFA}");
  expect(svg.indexOf("<style>")).toBeLessThan(svg.indexOf("<rect"));
});

test("the geometry has one tile, four ink cards and one brand card", () => {
  expect(KIBO_MARK.tile).toEqual({ x: 2, y: 2, size: 96, radius: 24, stroke: 2 });
  expect(KIBO_MARK.cards).toHaveLength(5);
  expect(KIBO_MARK.cards.filter((c) => c.fill === "brand")).toEqual([
    { x: 42, y: 46, w: 16, h: 30, fill: "brand", opacity: 1 },
  ]);
});
