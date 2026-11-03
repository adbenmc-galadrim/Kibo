import { Check } from "lucide-react";
import { useEffect } from "react";
import { fr } from "../i18n/fr";

type PickerProject = { id: string; name: string; color: string };

type PickerProps = {
  projects: PickerProject[];
  current: string;
  onSelect(projectId: string): void;
  onClose(): void;
};

export function ProjectPicker({ projects, current, onSelect, onClose }: PickerProps) {
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
        aria-label={fr.picker.close}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={fr.picker.title}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-(--tracking-bg) px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]"
      >
        <div aria-hidden className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-(--tracking-border)" />
        <h2 className="px-3 py-2 text-[13px] font-semibold text-(--tracking-dim)">{fr.picker.title}</h2>
        <ul>
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                aria-current={p.id === current ? "true" : undefined}
                onClick={() => onSelect(p.id)}
                className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium"
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span className="flex-1 truncate">{p.name}</span>
                {p.id === current ? <Check aria-hidden size={18} className="text-(--tracking-dim)" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
