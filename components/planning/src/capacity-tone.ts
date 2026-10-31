export type CapacityTone = "amber" | "neutral";

type Identified = { id: string };

export function capacityTone(
  sprint: Identified,
  current: Identified | null,
  next: Identified | null,
  over: boolean,
): CapacityTone {
  return over && (sprint.id === current?.id || sprint.id === next?.id) ? "amber" : "neutral";
}
