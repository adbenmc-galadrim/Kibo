import type { RunLogEntry } from "@kibo/schema";

export function draftRelativeLog(log: RunLogEntry[], draftId: string): RunLogEntry[] {
  const marker = `/components/drafts/${draftId}/`;
  const relative = (detail: string) => {
    const at = detail.indexOf(marker);
    return at < 0
      ? detail
      : `${detail.slice(0, detail.lastIndexOf(" ", at) + 1)}${detail.slice(at + marker.length)}`;
  };
  return log.map((entry) =>
    entry.event.type === "hook" && entry.event.payload.detail
      ? {
          ...entry,
          event: {
            ...entry.event,
            payload: { ...entry.event.payload, detail: relative(entry.event.payload.detail) },
          },
        }
      : entry,
  );
}
