import { changelogSection } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Fragment } from "react";
import { frWhatsNew as t } from "../i18n/fr-whats-new";
import { RELEASES_URL } from "../lib/kibo-links";

type Props = { open: boolean; version: string; changelog: string; onSeen(version: string): void };

type Block = { id: number; kind: "list"; items: string[] } | { id: number; kind: "text"; text: string };

function blocksOf(section: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of section.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const item = /^[-*] (.+)$/.exec(line)?.[1];
    const last = blocks.at(-1);
    if (item && last?.kind === "list") last.items.push(item);
    else if (item) blocks.push({ id: blocks.length, kind: "list", items: [item] });
    else blocks.push({ id: blocks.length, kind: "text", text: line });
  }
  return blocks;
}

function Inline({ text }: { text: string }) {
  return text.split("`").map((part, i) =>
    i % 2 === 1 ? (
      <code key={`${i}-${part}`} className="rounded bg-muted px-1 font-mono text-[0.85em]">
        {part}
      </code>
    ) : (
      <Fragment key={`${i}-${part}`}>{part}</Fragment>
    ),
  );
}

function Notes({ blocks }: { blocks: Block[] }) {
  if (blocks.length === 0) return <p className="text-sm text-muted-foreground">{t.empty}</p>;
  return (
    <div className="grid gap-3 text-sm">
      {blocks.map((b) =>
        b.kind === "list" ? (
          <ul key={b.id} className="grid list-disc gap-1.5 pl-5">
            {b.items.map((item) => (
              <li key={item}>
                <Inline text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={b.id}>
            <Inline text={b.text} />
          </p>
        ),
      )}
    </div>
  );
}

export function WhatsNewDialog({ open, version, changelog, onSeen }: Props) {
  const blocks = blocksOf(changelogSection(changelog, version) ?? "");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onSeen(version)}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t.title(version)}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Notes blocks={blocks} />
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {t.allNotes}
          </a>
          <Button onClick={() => onSeen(version)}>{t.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
