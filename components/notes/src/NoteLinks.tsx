import type { NoteMeta, StatusId } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { fr } from "./fr";

export type LinkedTicket = { key: string; id: string; title: string; statusId: StatusId };
export type Backlink = { note: NoteMeta; count: number };

type Props = {
  linked: LinkedTicket[];
  backlinks: Backlink[];
  onTicket(id: string): void;
  onNote(path: string): void;
};

export function NoteLinks({ linked, backlinks, onTicket, onNote }: Props) {
  return (
    <aside className="grid w-64 min-w-0 shrink-0 content-start gap-6 border-l p-3 text-sm">
      <section aria-label={fr.linkedTickets} className="grid min-w-0 gap-2">
        <h2 className="text-xs font-semibold">{fr.linkedTickets}</h2>
        {linked.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTicket(t.id)}
            className="flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs hover:bg-accent"
          >
            <StatusDot statusId={t.statusId} />
            <span className="shrink-0 font-mono text-muted-foreground">{t.key}</span>
            <span className="min-w-0 truncate">{t.title}</span>
          </button>
        ))}
      </section>
      <section aria-label={fr.backlinks} className="grid gap-3">
        <h2 className="text-xs font-semibold">{fr.backlinks}</h2>
        {backlinks.map((b) => (
          <button
            key={b.note.path}
            type="button"
            onClick={() => onNote(b.note.path)}
            className="grid gap-0.5 rounded-md text-left text-xs hover:underline"
          >
            <span>{b.note.title}</span>
            <span className="text-muted-foreground">
              {b.count === 1 ? fr.mentionsOnce : fr.mentions(b.count)}
            </span>
          </button>
        ))}
      </section>
    </aside>
  );
}
