export type Match = { term: number; line: number };

const BINARY_HEAD_BYTES = 8192;
const WORD_CHAR = "[\\p{L}\\p{M}\\p{N}_]";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function termPattern(term: string): RegExp {
  return new RegExp(`(?<!${WORD_CHAR})${escapeRegExp(term.normalize("NFC"))}(?!${WORD_CHAR})`, "giu");
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
    for (const found of normalized.matchAll(termPattern(term))) {
      starts ??= lineStarts(normalized);
      matches.push({ term: position + 1, line: lineOf(starts, found.index) });
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
      (masked, { term, position }) => masked.replace(termPattern(term), `<terme ${position + 1}>`),
      text.normalize("NFC"),
    );
}
