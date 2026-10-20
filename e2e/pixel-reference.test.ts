import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MASK_RGB, type MaskedScreen, PIXEL_HEIGHTS, PIXEL_MASKS, referenceOf } from "./pixel-masks";
import { assertComparedAgainst, comparedReference, cropImage, sourceReference } from "./pixel-reference";
import { decodePng } from "./pixel-report";
import { DESIGN_REFERENCES } from "./pixel-settings";

const screens = Object.keys(PIXEL_HEIGHTS).filter((s): s is MaskedScreen => Object.hasOwn(PIXEL_MASKS, s));
const designFile = (screen: MaskedScreen, scheme: string) =>
  `proposition-${referenceOf(screen)}-${scheme}.png`;
const pixel = (data: Uint8Array, width: number, x: number, y: number) => [
  ...data.subarray((y * width + x) * 4, (y * width + x) * 4 + 3),
];

const masked = (screen: MaskedScreen, x: number, y: number) =>
  PIXEL_MASKS[screen].some((m) => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h);

test("the compared reference of every screen is the mockup PNG, painted only where it is masked", () => {
  for (const screen of screens)
    for (const scheme of ["dark", "light"]) {
      const file = designFile(screen, scheme);
      const raw = readFileSync(join(DESIGN_REFERENCES, file));
      const source = sourceReference(DESIGN_REFERENCES, file, { width: 1440, height: PIXEL_HEIGHTS[screen] });
      expect(source).toEqual(raw);
      const design = decodePng(raw);
      const compared = decodePng(comparedReference(source, PIXEL_MASKS[screen]));
      expect([compared.width, compared.height]).toEqual([design.width, design.height]);
      let changed = 0;
      for (let y = 0; y < design.height; y += 3)
        for (let x = 0; x < design.width; x += 3) {
          const want = masked(screen, x, y) ? [...MASK_RGB] : pixel(design.data, design.width, x, y);
          if (pixel(compared.data, compared.width, x, y).join() !== want.join()) changed++;
        }
      expect(`${file}: ${changed}`).toBe(`${file}: 0`);
    }
}, 30_000);

test("the compared content zone is the same crop of the mockup", () => {
  const file = designFile("tickets", "dark");
  const raw = readFileSync(join(DESIGN_REFERENCES, file));
  const region = { x: 241, y: 49, w: 1199, h: 951 };
  const compared = decodePng(comparedReference(raw, [], region));
  expect(compared).toEqual(cropImage(decodePng(raw), region));
});

test("a comparison against anything but the reference derived from the mockup is refused", () => {
  const reference = comparedReference(
    readFileSync(join(DESIGN_REFERENCES, designFile("graphe", "dark"))),
    [],
  );
  const stale = readFileSync(join(DESIGN_REFERENCES, designFile("graphe", "light")));
  const expected = (body: Uint8Array) => ({ name: "proposition-graphe-dark-expected.png", body });
  expect(() => assertComparedAgainst([expected(reference)], reference)).not.toThrow();
  expect(() => assertComparedAgainst([expected(stale)], reference)).toThrow("is not derived from the mockup");
  expect(() => assertComparedAgainst([], reference)).toThrow("no expected image");
});

test("a diff between two captures of an unsettled page is refused", () => {
  const reference = readFileSync(join(DESIGN_REFERENCES, designFile("graphe", "dark")));
  const attachments = [
    { name: "proposition-graphe-dark-expected.png", body: reference },
    { name: "proposition-graphe-dark-previous.png", body: reference },
  ];
  expect(() => assertComparedAgainst(attachments, reference)).toThrow("compares two captures");
});

test("a mockup whose size differs from the capture is refused", () => {
  expect(() =>
    sourceReference(DESIGN_REFERENCES, designFile("graphe", "dark"), { width: 1440, height: 1260 }),
  ).toThrow("is 1440×1000, capture is 1440×1260");
});
