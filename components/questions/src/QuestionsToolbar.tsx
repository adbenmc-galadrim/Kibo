import type { TicketView } from "@kibo/schema";
import { TicketKeyLabel } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Input } from "@kibo/sdk/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { fr } from "./fr";
import type { Scope } from "./questions-logic";

const SCOPES: readonly Scope[] = ["open", "answered", "all"];

type Props = {
  scope: Scope;
  ticket: TicketView | null;
  tickets: readonly TicketView[];
  readOnly: boolean;
  onScope(scope: Scope): void;
  onTicket(ticketId: string | null): void;
  onNew(): void;
};

function TicketMenu({ ticket, tickets, onTicket }: Pick<Props, "ticket" | "tickets" | "onTicket">) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const shown = tickets.filter((t) => t.keyLabel.toLowerCase().includes(needle));
  return (
    <DropdownMenu onOpenChange={() => setSearch("")}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs font-normal">
          {ticket ? <TicketKeyLabel ticket={ticket} className="font-mono" /> : fr.ticketFilter.all}
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        <Input
          aria-label={fr.ticketFilter.search}
          placeholder={fr.ticketFilter.search}
          className="mb-1 h-7 text-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <DropdownMenuItem className="text-xs" onSelect={() => onTicket(null)}>
          {fr.ticketFilter.all}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {shown.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{fr.ticketFilter.none}</p>
        )}
        {shown.map((t) => (
          <DropdownMenuItem key={t.id} className="text-xs" onSelect={() => onTicket(t.id)}>
            <TicketKeyLabel ticket={t} className="shrink-0 font-mono text-2xs text-muted-foreground" />
            <span className="truncate">{t.title}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function QuestionsToolbar({ scope, ticket, tickets, readOnly, onScope, onTicket, onNew }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={fr.scope.label}
        value={scope}
        onValueChange={(v) => {
          const next = SCOPES.find((s) => s === v);
          if (next) onScope(next);
        }}
      >
        {SCOPES.map((s) => (
          <ToggleGroupItem key={s} value={s} className="h-7 px-2.5 text-xs font-normal">
            {fr.scope[s]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <TicketMenu ticket={ticket} tickets={tickets} onTicket={onTicket} />
      <span className="flex-1" />
      {readOnly ? (
        <span className="text-xs text-muted-foreground">{fr.readOnly}</span>
      ) : (
        <Button size="sm" className="h-7 text-xs" onClick={onNew}>
          <Plus aria-hidden />
          {fr.newQuestion}
        </Button>
      )}
    </div>
  );
}
