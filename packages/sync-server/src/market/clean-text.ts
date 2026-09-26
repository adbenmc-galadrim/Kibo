import { z } from "zod";

const INVISIBLE = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Cs}\p{Zl}\p{Zp}]/u;
const DOUBLE_SPACE = /\s{2}/u;
const INVISIBLE_BLANKS: readonly (readonly [number, number])[] = [
  [0x00ad, 0x00ad],
  [0x034f, 0x034f],
  [0x115f, 0x1160],
  [0x17b4, 0x17b5],
  [0x180b, 0x180f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x206f],
  [0x2800, 0x2800],
  [0x3164, 0x3164],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
  [0xe0000, 0xe0fff],
];

const isInvisibleBlank = (codePoint: number): boolean =>
  INVISIBLE_BLANKS.some(([from, to]) => codePoint >= from && codePoint <= to);

function hasInvisibleBlank(text: string): boolean {
  for (const char of text) if (isInvisibleBlank(char.codePointAt(0) ?? 0)) return true;
  return false;
}

export function isCleanText(text: string): boolean {
  return (
    text.length > 0 &&
    text.trim() === text &&
    text.normalize("NFC") === text &&
    !INVISIBLE.test(text) &&
    !DOUBLE_SPACE.test(text) &&
    !hasInvisibleBlank(text)
  );
}

const LATIN = /\p{Script=Latin}/u;
const CONFUSABLE_WITH_LATIN = /[\p{Script=Cyrillic}\p{Script=Greek}]/u;

export const isCleanName = (name: string): boolean =>
  isCleanText(name) && !(LATIN.test(name) && CONFUSABLE_WITH_LATIN.test(name));

export const CleanText = (max: number) =>
  z
    .string()
    .max(max)
    .refine(isCleanText, "text must be visible, NFC, single-spaced and without control characters");
