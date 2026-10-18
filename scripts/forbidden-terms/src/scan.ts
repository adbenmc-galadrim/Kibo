export type Match = { term: number; line: number };

const BINARY_HEAD_BYTES = 8192;
const LETTER = /[\p{L}\p{M}]/u;
const UPPER = /\p{Lu}/u;
const LOWER = /\p{Ll}/u;

type Range = { start: number; end: number };

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const isLetter = (char: string | undefined): boolean => char !== undefined && LETTER.test(char);
const camelStep = (left: string | undefined, right: string | undefined): boolean =>
  left !== undefined && right !== undefined && LOWER.test(left) && UPPER.test(right);

function standsAlone(text: string, { start, end }: Range): boolean {
  const before = text[start - 1];
  const after = text[end];
  const leftOk = !isLetter(before) || camelStep(before, text[start]);
  const rightOk = !isLetter(after) || camelStep(text[end - 1], after);
  return leftOk && rightOk;
}

function termRanges(text: string, term: string): Range[] {
  const pattern = new RegExp(escapeRegExp(term.normalize("NFC")), "giu");
  return [...text.matchAll(pattern)]
    .map((found) => ({ start: found.index, end: found.index + found[0].length }))
    .filter((range) => standsAlone(text, range));
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) {
    starts.push(index + 1);
  }
  return starts;
}

function lineOf(starts: readonly number[], index: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((starts[middle] ?? 0) <= index) low = middle;
    else high = middle - 1;
  }
  return low + 1;
}

export function findForbidden(text: string, terms: readonly string[]): Match[] {
  const normalized = text.normalize("NFC");
  const matches: Match[] = [];
  let starts: number[] | null = null;
  terms.forEach((term, position) => {
    for (const range of termRanges(normalized, term)) {
      starts ??= lineStarts(normalized);
      matches.push({ term: position + 1, line: lineOf(starts, range.start) });
    }
  });
  return matches.sort((a, b) => a.line - b.line || a.term - b.term);
}

export function isBinary(head: Uint8Array): boolean {
  return head.subarray(0, BINARY_HEAD_BYTES).includes(0);
}

export function maskTerms(text: string, terms: readonly string[]): string {
  return terms
    .map((term, position) => ({ term, position }))
    .sort((a, b) => b.term.length - a.term.length)
    .reduce(
      (masked, { term, position }) => maskOne(masked, term, `<terme ${position + 1}>`),
      text.normalize("NFC"),
    );
}

function maskOne(text: string, term: string, label: string): string {
  return termRanges(text, term)
    .reverse()
    .reduce((masked, { start, end }) => `${masked.slice(0, start)}${label}${masked.slice(end)}`, text);
}
