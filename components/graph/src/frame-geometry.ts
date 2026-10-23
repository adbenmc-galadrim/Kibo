const GLYPHS: readonly (readonly [RegExp, number])[] = [
  [/[ijl'.,·]/, 0.24],
  [/[ftrI ]/, 0.32],
  [/[mwMW]/, 0.84],
  [/[A-Z]/, 0.66],
  [/[0-9]/, 0.58],
];
const DEFAULT_GLYPH = 0.54;

export const FRAME_MIN_W = 126;
export const FRAME_MAX_W = 262;
export const FRAME_PAD = 10;
export const FRAME_GAP = 6;
export const FRAME_HEAD_H = 14;
export const TITLE_LINE_H = 15;
export const SEGMENT_H = 5;
export const STEP_ROW_H = 24;
export const FOOTER_H = 14;
export const STACK_GAP = 30;
export const FIRST_FRAME_Y = 70;
export const LANE_MARGIN = 14;
export const NARROW_LANE_MARGIN = 12;

const TITLE_PX = 12.5;
const STEP_PX = 11.5;
const STEP_ROW_CHROME = 46;
const SESSION_DOT = 12;
const BREATHING = 34;
const SNAP = 10;
const SNAP_OFFSET = 2;

export const textWidth = (text: string, px: number): number =>
  [...text].reduce((sum, c) => sum + (GLYPHS.find(([r]) => r.test(c))?.[1] ?? DEFAULT_GLYPH), 0) * px;

export const titleWidth = (title: string): number => textWidth(title, TITLE_PX);

export type SizedStep = { title: string; session: boolean };

const rowWidth = (s: SizedStep): number =>
  textWidth(s.title, STEP_PX) + STEP_ROW_CHROME + (s.session ? SESSION_DOT : 0);

export function frameWidth(title: string, steps: readonly SizedStep[]): number {
  const content = Math.max(titleWidth(title), ...steps.map(rowWidth));
  const natural = content + 2 * FRAME_PAD + BREATHING;
  const snapped = Math.ceil((natural - SNAP_OFFSET) / SNAP) * SNAP + SNAP_OFFSET;
  return Math.min(FRAME_MAX_W, Math.max(FRAME_MIN_W, snapped));
}

export type TitleLines = 1 | 2 | 3;
export const TITLE_MAX_LINES = 3;

export function wrapTitle(title: string, width: number): string[] {
  const inner = width - 2 * FRAME_PAD;
  const lines: string[] = [];
  for (const word of title.split(" ").filter((w) => w !== "")) {
    const last = lines.at(-1);
    const joined = last === undefined ? word : `${last} ${word}`;
    if (last !== undefined && titleWidth(joined) <= inner) lines[lines.length - 1] = joined;
    else lines.push(word);
  }
  return lines.length === 0 ? [title] : lines;
}

export function titleLines(title: string, width: number): TitleLines {
  const count = wrapTitle(title, width).length;
  return count >= TITLE_MAX_LINES ? TITLE_MAX_LINES : count === 2 ? 2 : 1;
}

export function frameHeight(input: { lines: TitleLines; steps: number; footer: boolean }): number {
  const head = FRAME_HEAD_H + FRAME_GAP + input.lines * TITLE_LINE_H + FRAME_GAP + SEGMENT_H;
  const rows = input.steps * (FRAME_GAP + STEP_ROW_H);
  const footer = input.footer ? FRAME_GAP + FOOTER_H : 0;
  return 2 * FRAME_PAD + head + rows + footer;
}

export const laneMargin = (frameW: number): number =>
  frameW <= FRAME_MIN_W ? NARROW_LANE_MARGIN : LANE_MARGIN;
