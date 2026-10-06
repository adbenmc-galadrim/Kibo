import { useSdk } from "@kibo/sdk";
import { bytesToBase64 } from "@kibo/sdk/lib/base64";
import { useEffect, useMemo, useRef } from "react";
import { fr } from "./fr";

export type RenderedMarkdownProps = {
  html: string;
  className: string;
  onTicket(key: string): void;
  onNote?(target: string): void;
  onTask?(line: number): void;
};

const MISSING_IMAGE =
  "inline-flex w-fit items-center rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground";

function missingImage(): HTMLElement {
  const placeholder = document.createElement("span");
  placeholder.setAttribute("role", "img");
  placeholder.setAttribute("aria-label", fr.imageMissing);
  placeholder.className = MISSING_IMAGE;
  placeholder.textContent = fr.imageMissing;
  return placeholder;
}

export function RenderedMarkdown({ html, className, onTicket, onNote, onTask }: RenderedMarkdownProps) {
  const host = useRef<HTMLDivElement>(null);
  const sdk = useSdk();
  const notesApi = useRef(sdk.notes);
  notesApi.current = sdk.notes;
  const handlers = useRef({ onTicket, onNote, onTask });
  handlers.current = { onTicket, onNote, onTask };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const box = target?.closest<HTMLInputElement>("input[data-task-line]");
      if (box) {
        e.preventDefault();
        handlers.current.onTask?.(Number(box.dataset.taskLine));
        return;
      }
      const chip = target?.closest<HTMLElement>("[data-ticket-key]");
      if (chip) {
        handlers.current.onTicket(chip.dataset.ticketKey ?? "");
        return;
      }
      const link = target?.closest<HTMLAnchorElement>("a[data-note-href]");
      if (!link) return;
      e.preventDefault();
      handlers.current.onNote?.(link.dataset.noteHref ?? "");
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el || !html.includes("data-asset")) return;
    let live = true;
    for (const img of Array.from(el.querySelectorAll<HTMLImageElement>("img[data-asset]"))) {
      notesApi.current.asset(img.dataset.asset ?? "").then(
        ({ mime, bytes }) => {
          if (live) img.src = `data:${mime};base64,${bytesToBase64(bytes)}`;
        },
        (e: unknown) => {
          console.error(e);
          if (live) img.replaceWith(missingImage());
        },
      );
    }
    return () => {
      live = false;
    };
  }, [html]);

  const inner = useMemo(() => ({ __html: html }), [html]);
  return <div ref={host} className={className} dangerouslySetInnerHTML={inner} />;
}
