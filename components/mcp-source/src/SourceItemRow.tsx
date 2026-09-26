import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import type { SourceItem } from "./extract";
import { fr } from "./fr";

type Props = { item: SourceItem; ticketKey: string | null; busy: boolean; onCreate(): void; onOpen(): void };

export function SourceItemRow({ item, ticketKey, busy, onCreate, onOpen }: Props) {
  return (
    <li className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0">
      <div className="grid min-w-0 flex-1 gap-0.5">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="truncate font-medium hover:underline"
          >
            {item.title}
          </a>
        ) : (
          <span className="truncate font-medium">{item.title}</span>
        )}
        {item.subtitle && <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>}
      </div>
      {ticketKey ? (
        <button type="button" onClick={onOpen}>
          <Badge variant="outline" className="font-mono">
            {ticketKey}
          </Badge>
        </button>
      ) : (
        <Button size="sm" variant="outline" disabled={busy} onClick={onCreate}>
          {fr.create}
        </Button>
      )}
    </li>
  );
}
