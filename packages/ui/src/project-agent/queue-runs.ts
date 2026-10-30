import type { RunView } from "@kibo/schema";

export const holdsSlot = (r: RunView) => r.state === "running" || r.state === "starting";
