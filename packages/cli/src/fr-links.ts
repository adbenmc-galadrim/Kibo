export const frLinks = {
  linked: (from: string, to: string) => `✓ ${from} bloque ${to}`,
  unlinked: (from: string, to: string) => `✓ ${from} ne bloque plus ${to}`,
  notLinked: (from: string, to: string) => `${from} ne bloque pas ${to}`,
  cycle: (from: string, to: string) => `Cette dépendance créerait un cycle : ${from} dépend déjà de ${to}.`,
};
