import type { StatusMap } from "./integrations";
import { StatusId } from "./status";

function firstOpenStatus(map: StatusMap, option: string): StatusId | null {
  for (const s of StatusId.options) {
    if (s !== "done" && map[s] === option) return s;
  }
  return null;
}

export function remoteStatusId(closed: boolean, optionId: string | null, map: StatusMap | null): StatusId {
  if (closed) return "done";
  if (map === null || optionId === null) return "todo";
  return firstOpenStatus(map, optionId) ?? "todo";
}

export function projectStatus(statusId: StatusId, map: StatusMap | null, fallback: StatusId): StatusId {
  if (statusId === "done") return "done";
  if (map === null) return "todo";
  const option = map[statusId];
  if (option === undefined) return fallback;
  return firstOpenStatus(map, option) ?? fallback;
}
