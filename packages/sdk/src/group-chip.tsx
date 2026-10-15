import type { TicketView } from "@kibo/schema";
import { fr } from "./fr";
import { cn } from "./lib/utils";

export type GroupRef = Pick<TicketView, "id" | "keyLabel" | "title">;
type Props = { group: GroupRef; onOpen(id: string): void; className?: string };

export const GROUP_CHIP =
  "inline-flex max-w-24 shrink-0 items-center rounded-sm border border-dashed border-zinc-300 px-1 font-mono text-3xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800";

export function groupOfTicket<T extends GroupRef & Pick<TicketView, "parentId">>(
  tickets: readonly T[],
): (ticket: Pick<TicketView, "parentId">) => T | null {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  return (ticket) => (ticket.parentId === null ? null : (byId.get(ticket.parentId) ?? null));
}

export function GroupChip({ group, onOpen, className }: Props) {
  const name = fr.group.name(group.keyLabel, group.title);
  return (
    <button
      type="button"
      data-group-chip={group.keyLabel}
      title={name}
      aria-label={fr.group.open(name)}
      className={cn(GROUP_CHIP, className)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(group.id);
      }}
    >
      <span className="truncate">{group.keyLabel}</span>
    </button>
  );
}
