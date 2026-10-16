import { z } from "zod";
import { DEFAULT_OPEN_LIMIT } from "./feature-state";

export const TrackingSettings = z.object({ openLimit: z.number().int().min(1).max(10) }).strict();
export type TrackingSettings = z.infer<typeof TrackingSettings>;

export const openLimitOf = (settings: TrackingSettings | null): number =>
  settings?.openLimit ?? DEFAULT_OPEN_LIMIT;
