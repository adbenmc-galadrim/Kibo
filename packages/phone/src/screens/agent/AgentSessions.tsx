import { type AgentConversation, frProjectAgent } from "@kibo/ui/project-agent";

type Props = {
  items: AgentConversation["agents"];
  selected: string | null;
  onOpen(runId: string): void;
};

const t = frProjectAgent.list;

export function AgentSessions({ items, selected, onOpen }: Props) {
  return (
    <nav aria-label={t.title} className="absolute inset-0 z-10 overflow-y-auto bg-(--tracking-bg)">
      {items.length === 0 ? (
        <p className="p-4 text-[15px] text-(--tracking-mfg)">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-(--tracking-soft)">
          {items.map((item) => (
            <li
              key={item.runId}
              aria-current={item.runId === selected ? "true" : undefined}
              className="aria-[current]:bg-(--tracking-panel)"
            >
              <button
                type="button"
                onClick={() => onOpen(item.runId)}
                className="flex min-h-14 w-full flex-col justify-center gap-1 px-4 py-2 text-left"
              >
                <span className="truncate text-[15px] font-medium">{item.label}</span>
                <span className="flex gap-1 text-[12.5px] text-(--tracking-mfg)">
                  <span>
                    {item.date} · {t.messages(item.messages)}
                  </span>
                  {item.current ? <span className="text-(--tracking-brand-text)">{t.current}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
