import { expect, test } from "bun:test";
import fc from "fast-check";
import { encodePng, paintBoxes } from "./pixel-paint";
import { decodePng, pngSize } from "./pixel-report";

const imageArb = fc
  .record({ width: fc.integer({ min: 1, max: 12 }), height: fc.integer({ min: 1, max: 12 }) })
  .chain(({ width, height }) =>
    fc
      .uint8Array({ minLength: width * height * 4, maxLength: width * height * 4 })
      .map((data) => ({ width, height, data })),
  );

test("an encoded image decodes to the same pixels", () => {
  fc.assert(
    fc.property(imageArb, (image) => {
      const png = encodePng(image);
      expect(pngSize(png)).toEqual({ width: image.width, height: image.height });
      expect(decodePng(png).data).toEqual(image.data);
    }),
  );
});

test("painting fills the boxes with an opaque color, clipped to the image, and leaves the rest", () => {
  const image = { width: 4, height: 3, data: new Uint8Array(4 * 3 * 4).fill(7) };
  const painted = paintBoxes(image, [{ x: 3, y: 2, w: 5, h: 5 }], [255, 0, 255]);
  expect([...painted.data.subarray((2 * 4 + 3) * 4)]).toEqual([255, 0, 255, 255]);
  expect(painted.data.filter((v) => v === 7)).toHaveLength(4 * 3 * 4 - 4);
  expect(image.data.every((v) => v === 7)).toBe(true);
});
