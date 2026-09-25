import type { Status } from "@kibo/schema";
import { useEntities, useSdk } from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { buildTree, type TicketNode } from "./build-tree";
import { fr } from "./fr";

const DOT: Record<string, string> = {
  backlog: "border border-muted-foreground bg-transparent",
  todo: "bg-zinc-400",
  in_progress: "bg-blue-500",
  in_review: "bg-violet-500",
  blocked: "bg-red-500",
  done: "bg-green-500",
};

export function TicketsTree() {
  const sdk = useSdk();
  const { data: tickets, loading } = useEntities("ticket");
  const { data: statuses } = useEntities("status");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const label = (id: string) => statuses.find((s: Status) => s.id === id)?.label ?? id;
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const row = (n: TicketNode) => {
    const t = n.ticket;
    const open = !collapsed.has(t.id);
    return (
      <li key={t.id}>
        <div
          className="group flex h-9 items-center gap-2 border-b px-2 text-sm"
          style={{ paddingLeft: 8 + n.depth * 20 }}
        >
          {n.children.length > 0 ? (
            <button
              type="button"
              aria-label={open ? fr.collapse(t.key) : fr.expand(t.key)}
              onClick={() => toggle(t.id)}
            >
              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <span className="size-4" />
          )}
          <span className={`size-2 rounded-full ${DOT[t.statusId] ?? ""}`} title={label(t.statusId)} />
          <span className="w-16 font-mono text-xs text-muted-foreground">{t.key}</span>
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left"
            onClick={() => sdk.openTicket(t.id)}
          >
            {t.title}
          </button>
          {t.blockedReason && <span className="truncate text-xs text-red-500">{t.blockedReason}</span>}
          {t.waitingOn.length > 0 && <Badge variant="outline">{fr.waitingOn(t.waitingOn)}</Badge>}
          {t.progress.total > 0 && (
            <span className="font-mono text-xs text-muted-foreground">{`${t.progress.done}/${t.progress.total}`}</span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="size-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label={fr.newSubTicket(t.key)}
            onClick={() => sdk.openNewTicket({ parentId: t.id })}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        {open && n.children.length > 0 && <ul>{n.children.map(row)}</ul>}
      </li>
    );
  };

  return (
    <section aria-label={fr.title} className="flex h-full flex-col">
      <header className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">{fr.title}</span>
        <Button size="sm" variant="outline" onClick={() => sdk.openNewTicket({})}>
          <Plus className="size-3.5" /> {fr.newTicket}
        </Button>
      </header>
      {loading ? null : tickets.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">{fr.empty}</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto">{buildTree(tickets).map(row)}</ul>
      )}
    </section>
  );
}
