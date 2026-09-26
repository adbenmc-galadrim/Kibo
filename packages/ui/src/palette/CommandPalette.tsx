import type { TabTarget } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@kibo/sdk/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Bell, Bot, FileText, FolderKanban, GitCommitHorizontal, Plus, SunMoon, Ticket } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { fr } from "../i18n/fr";
import { SCREENS } from "../tabs/screens";
import { agentItems } from "./agent-items";
import {
  activeTicket,
  buildItems,
  FILTERS,
  type PaletteAction,
  type PaletteContext,
  type PaletteFilter,
  type PaletteItem,
  searchItems,
} from "./palette-items";

type Props = {
  open: boolean;
  onOpenChange(open: boolean): void;
  newTab: boolean;
  context: PaletteContext;
  onOpenTarget(target: TabTarget, newTab: boolean): void;
  onOpenTicketSheet(projectId: string, ticketId: string): void;
  onAction(action: PaletteAction): void;
};

const ICONS = {
  ticket: Ticket,
  page: FileText,
  project: FolderKanban,
  changes: GitCommitHorizontal,
  new: Plus,
  theme: SunMoon,
  reply: Bell,
  assign: Bot,
  agents: SCREENS.agents.icon,
  queue: SCREENS.queue.icon,
  general: SCREENS.general.icon,
  domains: SCREENS.domains.icon,
  components: SCREENS.components.icon,
  mine: SCREENS.mine.icon,
  integrations: SCREENS.integrations.icon,
};
const ICON_CLASS: Partial<Record<PaletteItem["icon"], string>> = {
  reply: "text-orange-600 dark:text-orange-400",
};
const FILTER_LABEL: Record<PaletteFilter, string> = {
  all: fr.palette.all,
  tickets: fr.palette.tickets,
  pages: fr.palette.pages,
  projects: fr.palette.projects,
  actions: fr.palette.actions,
  agents: fr.palette.agents,
};

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
      {children}
    </kbd>
  );
}

function Row({ item }: { item: PaletteItem }) {
  const Icon = ICONS[item.icon];
  return (
    <>
      {item.statusId ? (
        <StatusDot statusId={item.statusId} />
      ) : item.color ? (
        <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: item.color }} />
      ) : (
        <Icon aria-hidden className={cn("size-4", ICON_CLASS[item.icon])} />
      )}
      <span className="truncate">{item.label}</span>
      {item.detail && <span className="ml-auto text-xs text-muted-foreground">{item.detail}</span>}
    </>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  newTab,
  context,
  onOpenTarget,
  onOpenTicketSheet,
  onAction,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PaletteFilter>("all");
  const [value, setValue] = useState("");
  const items = useMemo(
    () => [...buildItems(context), ...agentItems(context.agents?.runs ?? [], activeTicket(context))],
    [context],
  );
  const sections = useMemo(() => searchItems(items, query, filter), [items, query, filter]);
  const byId = useMemo(() => new Map(sections.flatMap((s) => s.items).map((i) => [i.id, i])), [sections]);

  useEffect(() => {
    if (open) return;
    setQuery("");
    setFilter("all");
  }, [open]);

  const run = (item: PaletteItem, sheet: boolean) => {
    onOpenChange(false);
    if (item.run.kind === "action") onAction(item.run.action);
    else if (sheet && item.ticket) onOpenTicketSheet(item.ticket.projectId, item.ticket.ticketId);
    else onOpenTarget(item.run.target, newTab);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const step = e.shiftKey ? FILTERS.length - 1 : 1;
      setFilter((f) => FILTERS[(FILTERS.indexOf(f) + step) % FILTERS.length] ?? "all");
      return;
    }
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
    const item = byId.get(value);
    if (!item?.ticket) return;
    e.preventDefault();
    run(item, true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[640px]"
      >
        <DialogTitle className="sr-only">{fr.palette.label}</DialogTitle>
        <DialogDescription className="sr-only">{fr.palette.placeholder}</DialogDescription>
        <Command
          shouldFilter={false}
          value={value}
          onValueChange={setValue}
          onKeyDown={onKeyDown}
          label={fr.palette.label}
          className="**:data-[slot=command-input-wrapper]:h-12 **:data-[slot=command-input-wrapper]:flex-1 **:data-[slot=command-input-wrapper]:border-0 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-[11px]"
        >
          <div className="flex items-center gap-2 border-b pr-3">
            <CommandInput
              className="h-12 text-[15px]"
              value={query}
              onValueChange={setQuery}
              placeholder={fr.palette.placeholder}
            />
            {filter !== "all" && (
              <span data-filter className="rounded border px-1.5 text-xs text-muted-foreground">
                {FILTER_LABEL[filter]}
              </span>
            )}
            <Kbd>{fr.palette.esc}</Kbd>
          </div>
          <CommandList className="max-h-[480px]">
            <CommandEmpty>{fr.palette.empty}</CommandEmpty>
            {sections.map((section) => (
              <CommandGroup key={section.group} heading={fr.palette[section.group]}>
                {section.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    className="py-2"
                    onSelect={() => run(item, false)}
                  >
                    <Row item={item} />
                  </CommandItem>
                ))}
                {section.more.length > 0 && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    {fr.palette.more(section.more.length, section.more.join(", "))}
                  </p>
                )}
              </CommandGroup>
            ))}
          </CommandList>
          <footer className="flex items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Kbd>↑↓</Kbd>
              {fr.palette.hintNavigate}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              {fr.palette.hintOpen}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>⌘↵</Kbd>
              {fr.palette.hintSheet}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>tab</Kbd>
              {fr.palette.hintFilter}
            </span>
          </footer>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
