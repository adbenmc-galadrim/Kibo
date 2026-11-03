export const formatClock = (at: number): string =>
  new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
