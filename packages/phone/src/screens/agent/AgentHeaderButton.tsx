import { Bot } from "lucide-react";
import { fr } from "../../i18n/fr";

export function AgentHeaderButton({ pending, onOpen }: { pending: number; onOpen(): void }) {
  return (
    <button
      type="button"
      aria-label={pending > 0 ? fr.header.agentPending(pending) : fr.header.agent}
      onClick={onOpen}
      className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-(--tracking-border) px-3"
    >
      <Bot aria-hidden size={18} className="text-(--tracking-brand)" />
      {pending > 0 ? (
        <span className="rounded-[9px] bg-(--tracking-brand-btn) px-1.5 font-mono text-[11px] font-semibold leading-[18px] text-white tabular-nums">
          {pending}
        </span>
      ) : null}
    </button>
  );
}
