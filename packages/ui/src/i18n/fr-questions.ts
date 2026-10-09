const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export const frQuestions = {
  badge: (n: number) => plural(n, "question"),
  open: "Ouvrir les questions",
  session: "Session principale",
  mainSession: (label: string, turns: number) => `${label} · ${plural(turns, "tour")}`,
};
