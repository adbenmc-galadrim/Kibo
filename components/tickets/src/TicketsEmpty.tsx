import { Button } from "@kibo/sdk/ui/button";
import { Skeleton } from "@kibo/sdk/ui/skeleton";
import { ListTree, Plus } from "lucide-react";
import { fr } from "./fr";

type Props = { readOnly: boolean; onNewTicket(): void };

export function TicketsEmpty({ readOnly, onNewTicket }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center">
      <ListTree aria-hidden className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{fr.empty}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{fr.emptyHelp}</p>
      {!readOnly && (
        <Button size="sm" variant="outline" className="mt-2" onClick={onNewTicket}>
          <Plus className="size-3.5" /> {fr.newTicket}
        </Button>
      )}
    </div>
  );
}

export function TicketsNoMatch({ onClear }: { onClear(): void }) {
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center">
      <p className="text-sm text-muted-foreground">{fr.noMatch}</p>
      <Button size="sm" variant="ghost" onClick={onClear}>
        {fr.clear}
      </Button>
    </div>
  );
}

export function TicketsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-2 px-3 py-3">
      {["w-2/3", "w-1/2", "w-3/5", "w-2/5", "w-4/5"].map((width) => (
        <Skeleton key={width} className={`h-5 ${width}`} />
      ))}
    </div>
  );
}
