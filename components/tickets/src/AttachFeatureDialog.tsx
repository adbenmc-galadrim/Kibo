import { featureLabel, isGroup, type TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { featureName } from "./FeatureChip";
import { fr } from "./fr";

type Props = {
  ticket: TicketView;
  features: readonly TicketView[];
  error: string | null;
  onAttach(feature: TicketView): void;
  onClose(): void;
};

export const isFeatureRoot = (t: TicketView): boolean => t.parentId === null && t.shortKey !== null;

export const canAttach = (t: TicketView): boolean =>
  t.parentId === null && t.shortKey === null && !isGroup(t);

export function attachTargets(tickets: readonly TicketView[]): TicketView[] {
  const order = (t: TicketView) => Number(featureLabel(t).slice(1)) || 0;
  return tickets.filter(isFeatureRoot).sort((a, b) => order(a) - order(b));
}

export function AttachFeatureDialog({ ticket, features, error, onAttach, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fr.attach.title(ticket.keyLabel)}</DialogTitle>
          <DialogDescription>{fr.attach.description}</DialogDescription>
        </DialogHeader>
        {features.length === 0 ? (
          <p className="text-muted-foreground text-sm">{fr.attach.none}</p>
        ) : (
          <ul className="grid max-h-80 gap-1 overflow-auto">
            {features.map((f) => (
              <li key={f.id}>
                <Button
                  variant="ghost"
                  className="w-full justify-start truncate font-normal"
                  onClick={() => onAttach(f)}
                >
                  {featureName(f)}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {fr.attach.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
