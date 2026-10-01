export type FindMatch = { line: number; col: number };
export type FindState = { query: string; matches: FindMatch[]; index: number };

export function findMatches(lines: readonly string[], query: string): FindMatch[] {
  if (query === "") return [];
  const needle = query.toLowerCase();
  return lines.flatMap((text, i) => {
    const haystack = text.toLowerCase();
    const found: FindMatch[] = [];
    for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) {
      found.push({ line: i + 1, col: at + 1 });
    }
    return found;
  });
}

export const parseGoTo = (query: string): number | null => {
  const match = /^:(\d+)$/.exec(query.trim());
  const line = match ? Number(match[1]) : 0;
  return line >= 1 ? line : null;
};

export const stepMatch = (state: FindState, delta: 1 | -1): FindState => {
  const count = state.matches.length;
  if (count === 0) return state;
  return { ...state, index: (state.index + delta + count) % count };
};
