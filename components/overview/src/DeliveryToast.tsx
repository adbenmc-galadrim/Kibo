import { CircleCheck, X } from "lucide-react";
import { useEffect } from "react";
import { DeliverySegments } from "./delivery-segments";
import { fr } from "./fr";
import { MONO_KEY } from "./parts";
import type { DeliveryToastRow } from "./use-delivery-toast";

const t = fr.delivered;
const CLOSE_AFTER_MS = 6000;

function DeliveryToast({ toast, onClose }: { toast: DeliveryToastRow; onClose(id: string): void }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), CLOSE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);
  return (
    <output className="flex w-[340px] flex-col gap-[8px] rounded-[10px] border border-(--tracking-border) bg-(--tracking-card) px-[14px] py-[12px] shadow-lg">
      <div className="flex items-center gap-[8px]">
        <CircleCheck absoluteStrokeWidth size={15} aria-hidden className="shrink-0 text-(--tracking-green)" />
        <span className={MONO_KEY}>{toast.label}</span>
        <span className="truncate font-semibold text-(--tracking-fg) text-[13px]">{toast.title}</span>
        <span className="shrink-0 text-(--tracking-mfg) text-[12.5px]">{t.toast}</span>
        <button
          type="button"
          aria-label={t.close}
          className="ml-auto cursor-pointer text-(--tracking-dim) hover:text-(--tracking-fg)"
          onClick={() => onClose(toast.id)}
        >
          <X absoluteStrokeWidth size={13} aria-hidden />
        </button>
      </div>
      <div className="flex items-center gap-[10px] pl-[23px]">
        <DeliverySegments steps={toast.steps} />
        <span className="text-(--tracking-mfg) text-[12px]">{t.steps(toast.steps)}</span>
      </div>
    </output>
  );
}

type Props = { toasts: readonly DeliveryToastRow[]; onClose(id: string): void };

export function DeliveryToasts({ toasts, onClose }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed right-[16px] bottom-[16px] z-40 flex flex-col gap-[8px]">
      {toasts.map((toast) => (
        <DeliveryToast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
