import { featureLabel, type ProjectCommand, type TicketView } from "@kibo/schema";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { frNewTicket } from "../i18n/fr-new-ticket";

export const NO_FEATURE = "none";
export const NEW_FEATURE = "new";

type Props = { id: string; tickets: readonly TicketView[]; value: string; onChange(value: string): void };

type Placement = Pick<Extract<ProjectCommand, { method: "createTicket" }>, "parentId" | "feature">;

export function placementOf(parentId: string | null | undefined, feature: string): Placement {
  if (parentId) return { parentId };
  if (feature === NEW_FEATURE) return { feature: true };
  return { parentId: feature === NO_FEATURE ? null : feature };
}

const order = (t: TicketView): number => Number(featureLabel(t).slice(1)) || 0;

export const featureChoices = (tickets: readonly TicketView[]): TicketView[] =>
  tickets.filter((t) => t.parentId === null && t.shortKey !== null).sort((a, b) => order(a) - order(b));

export function FeatureSelect({ id, tickets, value, onChange }: Props) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{frNewTicket.feature}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_FEATURE}>{frNewTicket.none}</SelectItem>
          {featureChoices(tickets).map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {`${featureLabel(f)} · ${f.title}`}
            </SelectItem>
          ))}
          <SelectItem value={NEW_FEATURE}>{frNewTicket.newFeature}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
