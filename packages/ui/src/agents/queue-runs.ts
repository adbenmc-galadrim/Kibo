import type { RunView } from "@kibo/schema";

export const holdsSlot = (r: RunView) => r.state === "running" || r.state === "starting";
export const byStart = (a: RunView, b: RunView) => (a.startedAt ?? 0) - (b.startedAt ?? 0);
