import { FR_DEVKIT } from "./fr";

export const MIN_FIXED_WIDTH = 240;

const CLASS_WIDTH = /(?<![\w-])((?:min-|max-)?w-\[(\d+(?:\.\d+)?)px\])/g;
const STYLE_WIDTH = /(?<![\w-])((?:min|max)(?:-w|W)idth|width)\s*:\s*["'`]?\s*(\d+(?:\.\d+)?)px/g;

type Hit = { at: number; token: string };

function hits(source: string, pattern: RegExp, token: (m: RegExpExecArray) => string): Hit[] {
  const out: Hit[] = [];
  for (const m of source.matchAll(pattern))
    if (Number(m[2]) >= MIN_FIXED_WIDTH) out.push({ at: m.index, token: token(m) });
  return out;
}

export function responsiveViolations(source: string, file = "ui.tsx"): string[] {
  return [
    ...hits(source, CLASS_WIDTH, (m) => m[1] ?? ""),
    ...hits(source, STYLE_WIDTH, (m) => `${m[1]}: ${m[2]}px`),
  ]
    .sort((a, b) => a.at - b.at)
    .map((h) => FR_DEVKIT.fixedWidth(file, h.token));
}
