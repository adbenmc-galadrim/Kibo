import { DELIVERY_STEP_MAX, type DeliveryStep, deliveryStepLabel } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { TEXT_12 } from "./columns";
import { fr } from "./fr";

export type SegmentTone = "past" | "current" | "next" | "delivered";

const TONE: Record<SegmentTone, string> = {
  past: "bg-(--tracking-mfg)",
  current: "bg-(--tracking-brand)",
  next: "bg-(--tracking-border)",
  delivered: "bg-(--tracking-green)",
};

export function segmentTones(step: number): SegmentTone[] {
  return Array.from({ length: DELIVERY_STEP_MAX + 1 }, (_, i) => {
    if (i < step) return "past";
    if (i > step) return "next";
    return step === DELIVERY_STEP_MAX ? "delivered" : "current";
  });
}

const SEGMENT_IDS = Array.from({ length: DELIVERY_STEP_MAX + 1 }, (_, i) => `segment-${i}`);

export function DeliveryCell({ delivery }: { delivery: DeliveryStep | null }) {
  if (!delivery) return <span className={cn("text-(--tracking-faint)", TEXT_12)}>{fr.none}</span>;
  const tones = segmentTones(delivery.step);
  return (
    <>
      <span aria-hidden className="flex shrink-0 items-center gap-[1.5px]">
        {SEGMENT_IDS.map((id, i) => {
          const tone = tones[i] ?? "next";
          return (
            <span key={id} data-segment={tone} className={cn("h-[10px] w-1 rounded-[1px]", TONE[tone])} />
          );
        })}
      </span>
      <span className={cn("truncate text-(--tracking-mfg)", TEXT_12)}>
        {deliveryStepLabel(delivery.step)}
      </span>
    </>
  );
}
