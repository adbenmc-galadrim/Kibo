import type { StatusId } from "@kibo/schema";

export const STROKE = "shadow-[inset_0_0_0_1px_var(--tracking-border)]";
export const STROKE_MFG = "shadow-[inset_0_0_0_1px_var(--tracking-mfg)]";
export const STROKE_BRAND = "shadow-[inset_0_0_0_1px_var(--tracking-brand-line)]";
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
