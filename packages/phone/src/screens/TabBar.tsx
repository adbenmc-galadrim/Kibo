import {
  CalendarRange,
  LayoutDashboard,
  type LucideIcon,
  MessageCircleQuestion,
  Network,
  SquareKanban,
} from "lucide-react";
import { fr } from "../i18n/fr";
import { formatRoute, PHONE_TABS, type PhoneTab } from "../route";

const ICONS: Record<PhoneTab, LucideIcon> = {
  graph: Network,
  kanban: SquareKanban,
  planning: CalendarRange,
  questions: MessageCircleQuestion,
  dashboard: LayoutDashboard,
};

export function TabBar({ projectId, active }: { projectId: string; active: PhoneTab | null }) {
  return (
    <nav
      aria-label={fr.tabsLabel}
      className="grid shrink-0 grid-cols-5 border-t border-(--tracking-border) bg-(--tracking-bg) pb-[env(safe-area-inset-bottom)]"
    >
      {PHONE_TABS.map((tab) => {
        const Icon = ICONS[tab];
        const current = tab === active;
        return (
          <a
            key={tab}
            href={formatRoute({ name: "tab", projectId, tab })}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 ${current ? "text-(--tracking-fg)" : "text-(--tracking-dim)"}`}
          >
            <Icon aria-hidden size={22} strokeWidth={current ? 2 : 1.75} />
            <span
              className={`whitespace-nowrap text-[11px] leading-none ${current ? "font-semibold" : "font-medium"}`}
            >
              {fr.tabs[tab]}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
