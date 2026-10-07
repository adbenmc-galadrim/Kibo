import type { TicketView } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { fr } from "./fr";

export function LinkedTickets({ tickets }: { tickets: TicketView[] }) {
  const sdk = useSdk();
  return (
    <section aria-label={fr.linked} className="max-h-24 shrink-0 overflow-auto border-t px-3 py-2">
      <p className="mb-1 text-xs text-muted-foreground">{fr.linked}</p>
      {tickets.length === 0 ? (
        <p className="text-xs text-muted-foreground">{fr.noLinked}</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {tickets.map((t) => (
            <Button
              key={t.id}
              variant="outline"
              size="xs"
              className="max-w-full"
              onClick={() => sdk.openTicket(t.id)}
            >
              <span className="truncate">{fr.ticket(t.keyLabel, t.title)}</span>
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
