import { DELIVERY_STEP_LABELS, DELIVERY_STEP_MAX, type DeliveryStep } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { frDelivery } from "../i18n/fr-delivery";
import { relativeTime } from "../lib/relative-time";

type Props = { delivery: DeliveryStep | null; now?: number };

const SEGMENTS = Array.from({ length: DELIVERY_STEP_MAX + 1 }, (_, i) => i);

export function DeliveryLine({ delivery, now = Date.now() }: Props) {
  if (delivery === null) return null;
  const label = DELIVERY_STEP_LABELS[delivery.step] ?? "";
  const parts = [relativeTime(delivery.at, now), delivery.note].filter((p) => p !== "");
  return (
    <div className="grid gap-1.5">
      <p>
        <span className="font-medium">
          {(delivery.kind === "update" ? frDelivery.retouchLine : frDelivery.line)(
            delivery.step,
            DELIVERY_STEP_MAX,
            label,
          )}
        </span>
        <span className="text-muted-foreground">{parts.map((p) => ` · ${p}`).join("")}</span>
      </p>
      <div
        role="progressbar"
        aria-label={frDelivery.bar(label)}
        aria-valuemin={0}
        aria-valuemax={DELIVERY_STEP_MAX}
        aria-valuenow={delivery.step}
        className="flex w-72 max-w-full gap-0.5"
      >
        {SEGMENTS.map((i) => (
          <span
            key={i}
            data-segment={i <= delivery.step ? "done" : "todo"}
            className={cn("h-1.5 flex-1 rounded-[1px]", i <= delivery.step ? "bg-brand" : "bg-border")}
          />
        ))}
      </div>
    </div>
  );
}
