export type HoldSpec = { n: number; reason: string };

export const SILO_HOLD_SINCE = "2026-10-16";
export const SILO_HOLDS: readonly HoldSpec[] = [
  { n: 45, reason: "Règle de fusion à valider par le client" },
  { n: 33, reason: "Serveur MinIO de recette indisponible" },
  { n: 82, reason: "Serveur MinIO de recette indisponible" },
];
export const SILO_HELD_BY_DEPENDENCY: readonly number[] = [34, 35];
export const SILO_HOLD_SOURCE = 33;
