import { CalendarRange } from "lucide-react";
import { STROKE } from "./styles";

export function SprintChip({ code }: { code: string }) {
  return (
    <span
      className={`inline-flex h-[15px] shrink-0 items-center gap-[4px] rounded-[4px] bg-(--tracking-muted) px-[6px] py-[1px] ${STROKE}`}
    >
      <CalendarRange aria-hidden className="size-[11px] text-(--tracking-fg)" />
      <span className="font-mono text-[10.5px] leading-[13px] font-medium text-(--tracking-fg)">{code}</span>
    </span>
  );
}
