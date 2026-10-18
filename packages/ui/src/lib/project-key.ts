const LINKING_WORDS = new Set([
  "DE",
  "DU",
  "DES",
  "LA",
  "LE",
  "LES",
  "ET",
  "EN",
  "AU",
  "AUX",
  "POUR",
  "SUR",
  "UN",
  "UNE",
]);

function significantWords(words: readonly string[]): readonly string[] {
  const kept = words.filter((w) => !LINKING_WORDS.has(w));
  return kept.length >= 2 ? kept : words;
}

export function suggestProjectKey(name: string): string {
  const words = significantWords(
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter(Boolean),
  );
  const key =
    words.length >= 2
      ? words
          .map((w) => w[0])
          .join("")
          .slice(0, 6)
      : (words[0] ?? "").slice(0, 3);
  return key.length >= 2 ? key : "";
}
