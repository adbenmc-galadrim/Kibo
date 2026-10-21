import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Plus, X } from "lucide-react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import type { AgentListItem } from "./agent-list";

type Props = {
  items: readonly AgentListItem[];
  selected: string | null;
  canReset: boolean;
  onOpen(runId: string): void;
  onNew(): void;
  onClose?(): void;
};

const t = frProjectAgent.list;

export function AgentList({ items, selected, canReset, onOpen, onNew, onClose }: Props) {
  return (
    <nav
      aria-label={t.title}
      className="flex min-h-0 flex-col gap-2 overflow-y-auto border-r bg-background p-2"
    >
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 justify-start"
          disabled={!canReset}
          onClick={onNew}
        >
          <Plus />
          {t.newAgent}
        </Button>
        {onClose && (
          <Button variant="ghost" size="icon" className="size-8" aria-label={t.close} onClick={onClose}>
            <X />
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="grid gap-0.5">
          {items.map((item) => (
            <AgentListRow key={item.runId} item={item} selected={item.runId === selected} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </nav>
  );
}

function AgentListRow({
  item,
  selected,
  onOpen,
}: {
  item: AgentListItem;
  selected: boolean;
  onOpen(runId: string): void;
}) {
  return (
    <li aria-current={selected ? "true" : undefined}>
      <Button
        variant="ghost"
        className={cn(
          "h-auto w-full flex-col items-stretch gap-0.5 px-2 py-2 text-left font-normal",
          selected && "bg-(--tracking-panel)",
        )}
        onClick={() => onOpen(item.runId)}
      >
        <span className="truncate text-sm font-medium">{item.label}</span>
        <span className="flex gap-1 text-2xs text-muted-foreground">
          <span>
            {item.date} · {t.messages(item.messages)}
          </span>
          {item.current && <span className="text-(--tracking-brand-text)">{t.current}</span>}
        </span>
      </Button>
    </li>
  );
}
