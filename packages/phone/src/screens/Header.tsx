import { Bot, ChevronDown, ChevronLeft } from "lucide-react";
import { fr } from "../i18n/fr";

type HeaderProps = {
  project: { name: string; color: string } | null;
  page: string;
  pending: number;
  onPick(): void;
  onAgent(): void;
  onBack?: () => void;
};

const TAP = "flex min-h-11 items-center";

export function Header({ project, page, pending, onPick, onAgent, onBack }: HeaderProps) {
  return (
    <header className="shrink-0 border-b border-(--tracking-border) bg-(--tracking-bg) pt-[env(safe-area-inset-top)]">
      <div className="flex h-13 items-center gap-2 pr-3 pl-4">
        {onBack ? (
          <button
            type="button"
            aria-label={fr.back}
            onClick={onBack}
            className={`${TAP} -ml-2 min-w-11 justify-center`}
          >
            <ChevronLeft aria-hidden size={20} />
          </button>
        ) : null}
        {project ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={fr.header.pickProject(project.name)}
            onClick={onPick}
            className={`${TAP} min-w-0 gap-2`}
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <span className="truncate text-[15px] font-semibold">{project.name}</span>
            <ChevronDown aria-hidden size={14} className="shrink-0 text-(--tracking-dim)" />
          </button>
        ) : null}
        <span aria-hidden className="text-[15px] text-(--tracking-faint)">
          /
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{page}</span>
        <button
          type="button"
          aria-label={pending > 0 ? fr.header.agentPending(pending) : fr.header.agent}
          onClick={onAgent}
          className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-(--tracking-border) px-3"
        >
          <Bot aria-hidden size={18} className="text-(--tracking-brand)" />
          {pending > 0 ? (
            <span className="rounded-[9px] bg-(--tracking-brand-btn) px-1.5 font-mono text-[11px] font-semibold leading-[18px] text-white tabular-nums">
              {pending}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  );
}
