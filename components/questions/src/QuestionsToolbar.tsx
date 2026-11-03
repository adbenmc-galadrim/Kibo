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
import { ChevronDown, Ticket } from "lucide-react";
import { type ReactNode, useState } from "react";
import { fr } from "./fr";
import type { Scope } from "./questions-logic";

const SCOPES: readonly Scope[] = ["open", "answered", "all", "archived"];

export const FILTER_MENU =
  "h-6.5 gap-[7px] px-[11px] text-xs font-medium has-[>svg]:px-[11px] @max-xl:h-11 @max-xl:shrink-0 @max-xl:px-3.5 @max-xl:text-[15px]";

type Props = {
  scope: Scope;
  openCount: number;
  ticket: TicketView | null;
  tickets: readonly TicketView[];
  onScope(scope: Scope): void;
  onTicket(ticketId: string | null): void;
  filters: ReactNode;
  summary: ReactNode;
  actions: ReactNode;
};

function TicketMenu({ ticket, tickets, onTicket }: Pick<Props, "ticket" | "tickets" | "onTicket">) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const shown = tickets.filter((t) => t.keyLabel.toLowerCase().includes(needle));
  return (
    <DropdownMenu onOpenChange={() => setSearch("")}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={FILTER_MENU}>
          <Ticket aria-hidden className="size-3.25" />
          {ticket ? fr.ticketFilter.shown(ticket.keyLabel) : fr.ticketFilter.shownAll}
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

const SEGMENT =
  "h-5.75 gap-1.5 rounded-[5px] border border-transparent px-2.5 text-[12.5px] font-medium text-muted-foreground data-[state=on]:border-border data-[state=on]:bg-background data-[state=on]:text-foreground @max-xl:h-10 @max-xl:shrink-0 @max-xl:px-2.5 @max-xl:text-[14px]";

const PHONE_ROW =
  "contents @max-xl:relative @max-xl:flex @max-xl:basis-full @max-xl:items-center @max-xl:gap-2 @max-xl:overflow-x-auto";

export function QuestionsToolbar(props: Props) {
  const { scope, openCount, ticket, tickets, onScope, onTicket, filters, summary, actions } = props;
  return (
    <div
      role="toolbar"
      aria-label={fr.toolbar}
      className="flex min-h-13 flex-wrap items-center gap-2 border-b px-4 py-1.5 @max-xl:gap-3 @max-xl:py-3"
    >
      <ToggleGroup
        type="single"
        size="sm"
        aria-label={fr.scope.label}
        className="gap-0.5 rounded-[7px] bg-muted p-0.5 @max-xl:max-w-full @max-xl:overflow-x-auto @max-xl:rounded-[10px]"
        value={scope}
        onValueChange={(v) => {
          const next = SCOPES.find((s) => s === v);
          if (next) onScope(next);
        }}
      >
        {SCOPES.map((s) => (
          <ToggleGroupItem key={s} value={s} className={SEGMENT}>
            {fr.scope[s]}
            {s === "open" && (
              <span aria-hidden className="font-mono text-[10.5px] font-normal text-muted-foreground">
                {openCount}
              </span>
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className={PHONE_ROW}>
        {filters}
        <TicketMenu ticket={ticket} tickets={tickets} onTicket={onTicket} />
        <span className="flex-1" />
        <span className="contents @max-xl:sticky @max-xl:right-0 @max-xl:ml-auto @max-xl:flex @max-xl:shrink-0 @max-xl:bg-background @max-xl:pl-2">
          {actions}
        </span>
      </div>
      <span className="contents @max-xl:block @max-xl:basis-full @max-xl:empty:hidden">{summary}</span>
    </div>
  );
}
