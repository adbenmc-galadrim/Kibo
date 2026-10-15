import { deliveryBrief, type ProjectSnapshot, type TicketView } from "@kibo/schema";
import { deliverEntry } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Truck } from "lucide-react";
import { frDelivery } from "../i18n/fr-delivery";
import { canEdit } from "../state/access";
import { useAgentsState } from "../state/agents-context";
import { DeliverChildrenDialog } from "./DeliverChildrenDialog";
import { activeRunOf, hasChildren, useDeliver, useDeliveryAgentKnown } from "./use-deliver";

type Props = { project: ProjectSnapshot; ticket: TicketView };

export function DeliverButton({ project, ticket }: Props) {
  const agents = useAgentsState();
  const flow = useDeliver(project.meta.id, ticket);
  const agentKnown = useDeliveryAgentKnown(project.meta.id);
  const parent = hasChildren(project, ticket.id);
  const entry = deliverEntry({
    ticket,
    editable: canEdit(project),
    agentKnown,
    parent,
    run: activeRunOf(agents?.runs, ticket.id),
  });
  if (!entry) return null;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={entry.disabledReason !== null || flow.busy}
        title={ticket.key ? frDelivery.deliverHint(deliveryBrief(ticket.key)) : undefined}
        onClick={() => void flow.deliver()}
      >
        <Truck />
        {parent ? frDelivery.deliverChildren : frDelivery.deliver}
      </Button>
      {entry.disabledReason && (
        <span className="self-center text-xs text-muted-foreground">{entry.disabledReason}</span>
      )}
      {flow.error && (
        <p role="alert" className="basis-full text-xs text-destructive">
          {flow.error}
        </p>
      )}
      {flow.children && (
        <DeliverChildrenDialog
          projectId={project.meta.id}
          parent={flow.children.parent}
          items={flow.children.items}
          onClose={flow.closeChildren}
        />
      )}
    </>
  );
}
