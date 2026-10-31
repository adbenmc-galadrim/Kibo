export type SprintAlerts = {
  wontHold: readonly string[];
  lateBy: readonly string[];
  limit: string | null;
};

const SEPARATOR = " · ";

export function mergeSprintAlerts({ wontHold, lateBy, limit }: SprintAlerts): string | null {
  const parts = [...wontHold, ...lateBy, ...(limit === null ? [] : [limit])];
  return parts.length === 0 ? null : parts.join(SEPARATOR);
}
