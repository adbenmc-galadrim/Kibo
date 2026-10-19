import { z } from "zod";
import { SprintDate } from "./sprint";

export const HOLD_REASON_MAX = 80;
export const HoldReason = z.string().trim().min(1).max(HOLD_REASON_MAX);
export const Hold = z.object({ reason: HoldReason, since: SprintDate });
export type Hold = z.infer<typeof Hold>;
