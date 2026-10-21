import { expect, test } from "bun:test";
import fc from "fast-check";
import {
  FRAME_GAP,
  FRAME_HEAD_H,
  FRAME_MAX_W,
  FRAME_MIN_W,
  FRAME_PAD,
  frameHeight,
  SEGMENT_H,
  TITLE_LINE_H,
  textWidth,
  titleLines,
  wrapTitle,
} from "./frame-geometry";

test("the title wraps by words on the inner width and never beyond three lines", () => {
  expect(wrapTitle("Se connecter avec Microsoft", 126)).toEqual(["Se connecter avec", "Microsoft"]);
  expect(wrapTitle("Connexion, environnements et hébergement", 126)).toHaveLength(3);
  expect(titleLines("Connexion, environnements et hébergement", 126)).toBe(3);
  expect(titleLines("Se connecter avec le compte Microsoft de l'entreprise", 126)).toBe(3);
  expect(titleLines("Réaffecter un box", 262)).toBe(1);
  expect(wrapTitle("Supercalifragilisticexpialidocious", 126)).toHaveLength(1);
});

test("for any title and width, lines stay within 1 to 3, each line fits, and widening never adds a line", () => {
  const word = fc.stringMatching(/^[A-Za-zÀ-ÿ',.]{1,16}$/);
  const title = fc.array(word, { minLength: 1, maxLength: 12 }).map((w) => w.join(" "));
  const width = fc.integer({ min: FRAME_MIN_W, max: FRAME_MAX_W });
  fc.assert(
    fc.property(title, width, width, (t, w1, w2) => {
      const [narrow, wide] = w1 <= w2 ? [w1, w2] : [w2, w1];
      const lines = wrapTitle(t, narrow);
      const inner = narrow - 2 * FRAME_PAD;
      expect(lines.length).toBeGreaterThanOrEqual(1);
      for (const line of lines) expect(line.includes(" ") ? textWidth(line, 12.5) <= inner : true).toBe(true);
      expect(titleLines(t, narrow)).toBeGreaterThanOrEqual(titleLines(t, wide));
      expect([1, 2, 3]).toContain(titleLines(t, narrow));
      const h = frameHeight({ lines: titleLines(t, narrow), steps: 0, footer: false });
      expect(
        FRAME_PAD + FRAME_HEAD_H + FRAME_GAP + titleLines(t, narrow) * TITLE_LINE_H + FRAME_GAP + SEGMENT_H,
      ).toBeLessThanOrEqual(h - FRAME_PAD);
    }),
  );
});
