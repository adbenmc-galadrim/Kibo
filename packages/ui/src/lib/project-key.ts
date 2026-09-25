export function suggestProjectKey(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  const key =
    words.length >= 2
      ? words
          .map((w) => w[0])
          .join("")
          .slice(0, 6)
      : (words[0] ?? "").slice(0, 3);
  return key.length >= 2 ? key : "";
}
