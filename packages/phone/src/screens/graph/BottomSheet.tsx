import { type ReactNode, useEffect } from "react";
import { frGraph } from "../../i18n/fr-graph";

type Props = { label: string; onClose(): void; done?: boolean; children: ReactNode };

export function BottomSheet({ label, onClose, done = false, children }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label={frGraph.close}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-(--tracking-bg) pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]"
      >
        <div aria-hidden className="mx-auto mb-1 h-[5px] w-9 shrink-0 rounded-full bg-(--tracking-border)" />
        <div className="flex min-h-11 shrink-0 items-center gap-2 pr-2 pl-4">
          <h2 className="min-w-0 flex-1 truncate font-semibold text-[17px]">{label}</h2>
          {done && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 px-2 font-medium text-[15px] text-(--tracking-mfg)"
            >
              {frGraph.done}
            </button>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </>
  );
}
