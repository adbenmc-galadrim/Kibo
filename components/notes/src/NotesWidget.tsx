import { useEntities, useSdk } from "@kibo/sdk";
import { useEffect, useMemo, useState } from "react";
import { excerpt } from "./excerpt";
import { fr } from "./fr";
import { renderNote, type TicketRef } from "./markdown";
import { EXCERPT_PROSE } from "./markdown-styles";
import { RenderedMarkdown } from "./RenderedMarkdown";

export function NotesWidget() {
  const sdk = useSdk();
  const notes = useEntities("note");
  const ticketList = useEntities("ticket");
  const pinned = typeof sdk.config.path === "string" ? sdk.config.path : null;
  const target = notes.data.find((n) => n.path === pinned) ?? notes.data[0] ?? null;
  const path = target?.path ?? null;
  const version = target?.mtime ?? null;
  const [markdown, setMarkdown] = useState("");
  const [failed, setFailed] = useState(false);
  const tickets = useMemo(
    () =>
      new Map<string, TicketRef>(
        ticketList.data.flatMap((t): [string, TicketRef][] =>
          t.key === null ? [] : [[t.key, { id: t.id, title: t.title, statusId: t.statusId }]],
        ),
      ),
    [ticketList.data],
  );
  const html = useMemo(
    () => renderNote(excerpt(markdown), tickets, { tasks: "readonly" }),
    [markdown, tickets],
  );

  useEffect(() => {
    if (path === null || version === null) return;
    let live = true;
    sdk.notes.read(path).then(
      (c) => live && setMarkdown(c.markdown),
      (e: unknown) => {
        console.error(e);
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [sdk, path, version]);

  const openTicket = (key: string) => {
    const t = tickets.get(key);
    if (t) sdk.openTicket(t.id);
  };

  if (notes.error || failed) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.loadFailed}
      </p>
    );
  }
  if (notes.loading) return <div className="h-full" />;
  if (!target) return <p className="p-4 text-sm text-muted-foreground">{fr.emptyWidget}</p>;
  return (
    <div className="grid content-start gap-2 p-3 text-sm">
      <h3 className="font-semibold">
        <button type="button" className="text-left hover:underline" onClick={() => sdk.openView("notes")}>
          {target.title}
        </button>
      </h3>
      <RenderedMarkdown html={html} className={EXCERPT_PROSE} onTicket={openTicket} />
    </div>
  );
}
