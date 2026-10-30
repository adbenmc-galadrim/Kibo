const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const usedBy = (n: number) => `utilisé par ${plural(n, "ticket")}`;

export const frDomains = {
  workspaceDomains: "Domaines du workspace",
  domainsOf: (name: string) => `Domaines de ${name}`,
  usedBy,
} as const;
