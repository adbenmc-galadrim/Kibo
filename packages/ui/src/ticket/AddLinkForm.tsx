import { KiboError, type ProjectCommand, type ProjectSnapshot, type TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Plus } from "lucide-react";
import { useState } from "react";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import { linkCandidates } from "./links";
import { describeTicketError, useTicketCommand } from "./use-ticket-command";

type Direction = "blockedBy" | "blocks" | "relates";
const DIRECTIONS: readonly Direction[] = ["blockedBy", "blocks", "relates"];
const LABELS: Record<Direction, string> = {
  blockedBy: t.deps.blockedBy,
  blocks: t.deps.blocks,
  relates: t.deps.related,
};

const describeLinkError = (e: unknown): string => {
  if (!(e instanceof KiboError)) return t.deps.failed;
  if (e.code === "INVALID_INPUT") return t.deps.duplicate;
  const text = describeTicketError(e);
  return text === t.fallback ? t.deps.failed : text;
};

const linkCommand = (ticketId: string, otherId: string, direction: Direction): ProjectCommand =>
  direction === "blockedBy"
    ? { method: "addLink", from: otherId, to: ticketId, type: "blocks" }
    : { method: "addLink", from: ticketId, to: otherId, type: direction };

type Props = { project: ProjectSnapshot; ticket: TicketView };

export function AddLinkForm({ project, ticket }: Props) {
  const command = useTicketCommand(project.meta.id, describeLinkError);
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("blockedBy");
  const [query, setQuery] = useState("");
  if (!open)
    return (
      <Button size="sm" variant="outline" className="w-fit" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {t.deps.add}
      </Button>
    );
  const candidates = linkCandidates(project, ticket.id, query);
  const pickDirection = (value: string) => {
    const next = DIRECTIONS.find((d) => d === value);
    if (next) setDirection(next);
  };
  const add = async (otherId: string) => {
    if (await command.run(linkCommand(ticket.id, otherId, direction))) setQuery("");
  };
  return (
    <div className="grid gap-2 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Select value={direction} onValueChange={pickDirection}>
          <SelectTrigger size="sm" aria-label={t.deps.type} className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIRECTIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label={t.deps.search}
          placeholder={t.deps.searchPlaceholder}
          value={query}
          autoFocus
          className="h-8"
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t.deps.close}
        </Button>
      </div>
      {candidates.length === 0 ? (
        <p className="text-muted-foreground">{t.deps.noResult}</p>
      ) : (
        <div role="listbox" aria-label={t.deps.search} className="grid gap-0.5">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={false}
              className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-accent"
              disabled={command.busy}
              onClick={() => void add(c.id)}
            >
              <span className="font-mono text-2xs">{c.keyLabel}</span>{" "}
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      )}
      {command.error && (
        <p role="alert" className="text-destructive">
          {command.error}
        </p>
      )}
    </div>
  );
}
