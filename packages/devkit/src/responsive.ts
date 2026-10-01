import { FR_DEVKIT } from "./fr";

export const MIN_FIXED_WIDTH = 240;

const CLASS_WIDTH =
  /(?<=^|[\s"'`{(,])!?((?:[^\s"'`:]+:)*)((?:min-w|w|size)-\[(\d+(?:\.\d+)?)px\])!?(?=$|[\s"'`)},])/g;
const DECLARED_WIDTH = /(?<![\w-])(min-width|minWidth|width)\s*:\s*["'`]?\s*(\d+(?:\.\d+)?)px/g;
const INLINE_STYLE = /style=\{\{([^{}]*)\}\}/g;
const UNITLESS_WIDTH = /(?<![\w-])(minWidth|width)\s*:\s*(\d+(?:\.\d+)?)(?![\w.%"'`])/g;

type Hit = { at: number; token: string };

const wide = (n: string | undefined) => Number(n) >= MIN_FIXED_WIDTH;
const inCondition = (source: string, at: number) => source.slice(0, at).trimEnd().endsWith("(");
const onContainer = (variants: string) => variants.split(":").some((v) => v.startsWith("@"));

function classHits(source: string): Hit[] {
  return [...source.matchAll(CLASS_WIDTH)]
    .filter((m) => wide(m[3]) && !onContainer(m[1] ?? ""))
    .map((m) => ({ at: m.index, token: `${m[1] ?? ""}${m[2] ?? ""}` }));
}

function declaredHits(source: string): Hit[] {
  return [...source.matchAll(DECLARED_WIDTH)]
    .filter((m) => wide(m[2]) && !inCondition(source, m.index))
    .map((m) => ({ at: m.index, token: `${m[1]}: ${m[2]}px` }));
}

function unitlessHits(source: string): Hit[] {
  return [...source.matchAll(INLINE_STYLE)].flatMap((style) =>
    [...(style[1] ?? "").matchAll(UNITLESS_WIDTH)]
      .filter((m) => wide(m[2]))
      .map((m) => ({ at: style.index + m.index, token: `${m[1]}: ${m[2]}` })),
  );
}

export function responsiveViolations(source: string, file = "ui.tsx"): string[] {
  return [...classHits(source), ...declaredHits(source), ...unitlessHits(source)]
    .sort((a, b) => a.at - b.at)
    .map((h) => FR_DEVKIT.fixedWidth(file, h.token));
}
