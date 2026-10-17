import type { StatusId } from "@kibo/schema";

export const STROKE = "shadow-[0_0_0_0.5px_var(--tracking-border),inset_0_0_0_0.5px_var(--tracking-border)]";
export const STROKE_MFG = "shadow-[0_0_0_0.5px_var(--tracking-mfg),inset_0_0_0_0.5px_var(--tracking-mfg)]";
export const STROKE_BRAND =
  "shadow-[0_0_0_0.5px_var(--tracking-brand-line),inset_0_0_0_0.5px_var(--tracking-brand-line)]";
export const CARD = `rounded-[8px] bg-(--tracking-card) ${STROKE}`;
export const SEPARATOR = "h-px w-full shrink-0 bg-(--tracking-soft)";

export const STATUS_FILL: Partial<Record<StatusId, string>> = {
  done: "bg-(--tracking-green)",
  in_review: "bg-(--tracking-purple)",
  in_progress: "bg-(--tracking-blue)",
  blocked: "bg-(--tracking-red)",
};

export const STEP_SEGMENT: Partial<Record<StatusId, string>> = {
  done: "bg-(--tracking-fg)",
  in_review: "bg-(--tracking-purple)",
  in_progress: "bg-(--tracking-blue)",
  blocked: "bg-(--tracking-red)",
};

export const STEP_CIRCLE: Partial<Record<StatusId, string>> = {
  in_review: "bg-(--tracking-purple) text-white",
  in_progress: "bg-(--tracking-blue) text-white",
  blocked: "bg-(--tracking-red) text-white",
};
