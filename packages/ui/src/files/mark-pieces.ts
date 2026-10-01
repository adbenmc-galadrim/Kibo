export type Piece = { at: number; text: string; col: number | null; first: boolean };

export function splitToken(text: string, offset: number, cols: readonly number[], length: number): Piece[] {
  const end = offset + text.length;
  const cuts = new Set([offset, end]);
  for (const col of cols) {
    const start = col - 1;
    for (const cut of [start, start + length]) if (cut > offset && cut < end) cuts.add(cut);
  }
  const bounds = [...cuts].sort((a, b) => a - b);
  return bounds.slice(0, -1).map((at, i) => {
    const col = cols.find((c) => at >= c - 1 && at < c - 1 + length) ?? null;
    return { at, text: text.slice(at - offset, (bounds[i + 1] ?? end) - offset), col, first: col === at + 1 };
  });
}
