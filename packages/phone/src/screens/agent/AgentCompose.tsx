import { ComposeBox, frProjectAgent } from "@kibo/ui/project-agent";
import { ArrowLeft, Send } from "lucide-react";
import { formatClock } from "../../format-time";
import { frAgent } from "../../i18n/fr-agent";
import type { Presence } from "../../remote-client";

const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export function PastSessionBar({ startedAt, onBack }: { startedAt: number | null; onBack(): void }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-(--tracking-soft) px-4 pb-[env(safe-area-inset-bottom)]">
      <span className="truncate text-[12.5px] text-(--tracking-mfg)">
        {startedAt === null
          ? null
          : frProjectAgent.past.banner(`${DAY.format(startedAt)} ${formatClock(startedAt)}`)}
      </span>
      <button
        type="button"
        aria-label={frAgent.backToCurrent}
        onClick={onBack}
        className="flex min-h-11 shrink-0 items-center gap-1.5 text-[13px] font-medium"
      >
        <ArrowLeft aria-hidden size={15} />
        {frAgent.current}
      </button>
    </div>
  );
}

function OfflineCompose({ presence }: { presence: Presence }) {
  return (
    <div className="shrink-0 border-t border-(--tracking-soft)">
      <div className="flex items-center gap-2 border border-(--tracking-border) bg-(--tracking-muted) opacity-60">
        <textarea
          data-slot="textarea"
          disabled
          rows={1}
          aria-label={frProjectAgent.compose.label}
          placeholder={presence.phoneOnline ? frAgent.macOff : frAgent.phoneOffline}
          className="min-w-0 flex-1 resize-none bg-transparent placeholder:text-(--tracking-mfg)"
        />
        <button type="button" disabled aria-label={frProjectAgent.compose.send}>
          <Send aria-hidden size={15} />
        </button>
      </div>
    </div>
  );
}

type ComposeProps = {
  presence: Presence;
  placeholder: string;
  onSend(text: string): Promise<void>;
};

export const isWritable = (presence: Presence): boolean => presence.macOnline && presence.phoneOnline;

export function AgentCompose({ presence, placeholder, onSend }: ComposeProps) {
  return (
    <div className="phone-agent-compose pb-[env(safe-area-inset-bottom)]">
      {isWritable(presence) ? (
        <ComposeBox placeholder={placeholder} onSend={onSend} />
      ) : (
        <OfflineCompose presence={presence} />
      )}
    </div>
  );
}
