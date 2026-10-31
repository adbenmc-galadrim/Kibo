import { DELIVERY_STEP_MAX, type DeliveryStep, deliveryStepLabel } from "@kibo/schema";
import { frFeature as t } from "../../i18n/fr-group";

const SEGMENTS = Array.from({ length: DELIVERY_STEP_MAX + 1 }, (_, i) => i);

const segmentOf = (i: number, step: number): "done" | "current" | "todo" => {
  if (i < step) return "done";
  return i === step ? "current" : "todo";
};

const FILL = {
  done: "bg-(--tracking-mfg)",
  current: "bg-(--tracking-brand)",
  todo: "bg-(--tracking-border)",
} as const;

export function DeliverySegments({ delivery }: { delivery: DeliveryStep | null }) {
  if (delivery === null)
    return <span className="ml-auto text-[12px] leading-[15px] text-(--tracking-faint)">{t.noDelivery}</span>;
  const label = deliveryStepLabel(delivery.step);
  const final = delivery.step === DELIVERY_STEP_MAX;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-[8px]">
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={DELIVERY_STEP_MAX}
        aria-valuenow={delivery.step}
        className="flex items-center gap-[1.5px]"
      >
        {SEGMENTS.map((i) => {
          const segment = segmentOf(i, delivery.step);
          const fill = segment === "current" && final ? "bg-(--tracking-green)" : FILL[segment];
          return <span key={i} data-segment={segment} className={`h-[10px] w-[4px] rounded-[1px] ${fill}`} />;
        })}
      </span>
      <span className="text-[12px] leading-[15px] text-(--tracking-mfg)">{label}</span>
    </span>
  );
}
