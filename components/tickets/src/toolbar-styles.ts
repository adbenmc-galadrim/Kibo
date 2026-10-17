import { cn } from "@kibo/sdk/lib/utils";

export const OUTLINE = cn(
  "h-[25px] gap-[6px] rounded-[6px] border border-(--tracking-border) bg-transparent px-[9px] text-[12px] leading-[1.2] font-medium text-(--tracking-fg) shadow-none has-[>svg]:px-[9px]",
  "hover:bg-(--tracking-hover) hover:text-(--tracking-fg) dark:border-(--tracking-border) dark:bg-transparent dark:hover:bg-(--tracking-hover)",
  "aria-pressed:bg-(--tracking-muted) data-[state=open]:bg-(--tracking-muted)",
);
