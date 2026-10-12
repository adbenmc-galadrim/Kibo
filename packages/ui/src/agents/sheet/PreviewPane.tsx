import type { AgentPreview, AgentRef, TicketView } from "@kibo/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { ChevronRight, Eye } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { client } from "../../api";
import { frAgentsPage } from "../../i18n/fr-agents-page";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";

type Props = {
  open: boolean;
  onClose(): void;
  agentRef: AgentRef;
  name: string;
  projectId: string | null;
};

const t = frAgentsSkills.preview;
const EXAMPLE = "example";
const count = (n: number) => n.toLocaleString("fr-FR").replace(/\s/g, " ");

function Block({ title, text }: { title: string; text: string }) {
  return (
    <Collapsible className="group/block rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
        <ChevronRight
          aria-hidden
          className="size-4 transition-transform group-data-[state=open]/block:rotate-90"
        />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="max-h-72 overflow-auto border-t bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
          {text}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Command({ command }: { command: AgentPreview["command"] }) {
  const rows: [string, string][] = [
    [t.model, command.model],
    [t.permissions, frAgentsPage.permissionModes[command.permissionMode]],
    [t.tools, command.tools ? command.tools.join(", ") : t.allTools],
    [t.allow, command.allow.join(", ")],
    [t.subagents, command.subagents.length > 0 ? command.subagents.join(", ") : t.noSubagents],
    [t.skills, command.skills.mode === "all" ? t.allSkills : command.skills.ids.join(", ")],
  ];
  return (
    <section aria-label={t.command} className="grid gap-2">
      <h3 className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">{t.command}</h3>
      <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-y-1.5 rounded-md border p-3 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words font-mono">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function useTickets(projectId: string | null): TicketView[] {
  const [tickets, setTickets] = useState<TicketView[]>([]);
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    client.rpc({ method: "getProject", projectId }).then(
      (p) => alive && setTickets(p.tickets.filter((x) => x.key !== null)),
      () => alive && setTickets([]),
    );
    return () => {
      alive = false;
    };
  }, [projectId]);
  return tickets;
}

export function PreviewPane({ open, onClose, agentRef, name, projectId }: Props) {
  const id = useId();
  const tickets = useTickets(open ? projectId : null);
  const [ticketId, setTicketId] = useState(EXAMPLE);
  const [preview, setPreview] = useState<AgentPreview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setFailed(false);
    client
      .rpc({
        method: "agents.preview",
        ref: agentRef,
        ...(projectId ? { projectId } : {}),
        ...(ticketId !== EXAMPLE ? { ticketId } : {}),
      })
      .then(
        (p) => alive && setPreview(p),
        () => alive && setFailed(true),
      );
    return () => {
      alive = false;
    };
  }, [open, agentRef, projectId, ticketId]);

  const total = preview?.levels.reduce((n, l) => n + l.tokens, 0) ?? 0;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-[640px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Eye aria-hidden className="size-4" />
            {t.title}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-foreground">{name}</span>
            {t.on}
            <Select value={ticketId} onValueChange={setTicketId}>
              <SelectTrigger id={`${id}-ticket`} aria-label={t.ticket} size="sm" className="h-7 max-w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EXAMPLE}>{t.example}</SelectItem>
                {tickets.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {t.ticketOption(x.keyLabel, x.title)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t.failed}
            </p>
          )}
          {preview === null ? (
            <p className="text-sm text-muted-foreground">{t.loading}</p>
          ) : (
            <>
              <p className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.composed(count(total))}
              </p>
              <ul className="grid gap-1">
                {preview.levels.map((l) => (
                  <li
                    key={l.path}
                    className="grid grid-cols-[minmax(0,1fr)_auto] rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{l.label}</span>
                    <span className="row-span-2 self-center font-mono text-xs">{count(l.tokens)}</span>
                    <span className="truncate font-mono text-2xs text-muted-foreground">{l.path}</span>
                  </li>
                ))}
              </ul>
              <Block title={t.systemPrompt} text={preview.systemPrompt} />
              <Block title={t.brief} text={preview.brief} />
              <Block title={t.agentsJson} text={preview.agentsJson} />
              <Command command={preview.command} />
              <p className="text-xs text-muted-foreground">{t.noSecret}</p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
