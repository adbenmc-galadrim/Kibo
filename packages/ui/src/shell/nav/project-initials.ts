const LINK_WORDS: ReadonlySet<string> = new Set(["de", "du", "des", "la", "le", "les", "et", "d", "l"]);

const wordsOf = (name: string): string[] =>
  name.split(/[^\p{L}\p{N}]+/u).filter((w) => w !== "" && !LINK_WORDS.has(w.toLowerCase()));

export function projectInitials(name: string): string {
  const words = wordsOf(name);
  return words.length === 0
    ? "?"
    : words
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join("");
}
