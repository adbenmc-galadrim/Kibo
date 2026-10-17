import type { FeatureStatus } from "@kibo/schema";
import { frSprint } from "../../i18n/fr-sprint";
import { STEP_SEGMENT } from "../feature/styles";
import type { SprintFeature } from "./sprint-facts";

const BADGE: Record<FeatureStatus, string | null> = {
  todo: null,
  open: "bg-(--tracking-blue-soft) text-(--tracking-blue)",
  blocked: "bg-(--tracking-red-soft) text-(--tracking-red)",
  late: "bg-(--tracking-red-soft) text-(--tracking-red)",
  delivered: "bg-(--tracking-green-soft) text-(--tracking-green)",
};

export function SprintFeatureRow({ feature, onOpen }: { feature: SprintFeature; onOpen(id: string): void }) {
  const badge = BADGE[feature.status];
  return (
    <li className="border-b border-(--tracking-soft) last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(feature.id)}
        className="flex h-[37px] w-full items-center gap-[10px] px-[12px] text-left outline-none hover:bg-(--tracking-hover) focus-visible:bg-(--tracking-hover)"
      >
        <span className="w-[22px] shrink-0 font-mono text-[12px] leading-[15px] text-(--tracking-dim)">
          {feature.shortKey}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[15px] text-(--tracking-fg)">
          {feature.title}
        </span>
        {badge && (
          <span className={`rounded-[4px] px-[6px] py-[1px] text-[11px] leading-[14px] ${badge}`}>
            {frSprint.badge[feature.status]}
          </span>
        )}
        <span role="img" aria-label={frSprint.steps(feature.shortKey)} className="flex shrink-0 gap-[3px]">
          {feature.steps.map((step) => (
            <span
              key={step.ticketId}
              data-status={step.statusId}
              className={`h-[6px] w-[10px] rounded-[1.5px] ${STEP_SEGMENT[step.statusId] ?? "bg-(--tracking-border)"}`}
            />
          ))}
        </span>
      </button>
    </li>
  );
}
