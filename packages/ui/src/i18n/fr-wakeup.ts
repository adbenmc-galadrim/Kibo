const signals = (n: number) => `${n} signa${n > 1 ? "ux" : "l"}`;

export const frWakeup = {
  label: "Réveil automatique",
  event: (n: number) => `Réveil automatique · ${signals(n)}`,
  answered: (label: string, quote: string) => `${label} répondue : « ${quote} »`,
} as const;
