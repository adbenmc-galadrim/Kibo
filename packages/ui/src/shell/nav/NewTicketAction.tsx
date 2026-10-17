import type { Instance } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { frTracking } from "../../i18n/fr-tracking";
import { useHost } from "../Host";
import { PageActions } from "../page-actions";
import { newTicketSource } from "./new-ticket-pages";

type Props = { pageId: string; instances: readonly Pick<Instance, "pageId" | "component">[] };

export function NewTicketAction({ pageId, instances }: Props) {
  const host = useHost();
  if (newTicketSource(pageId, instances) !== "shell") return null;
  return (
    <PageActions>
      <Button
        variant="outline"
        className="h-[25px] gap-[6px] rounded-[6px] px-[10px] text-[12px] font-medium shadow-none has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[13px]"
        onClick={() => host.openNewTicket({})}
      >
        <Plus absoluteStrokeWidth size={13} /> {frTracking.newTicket}
      </Button>
    </PageActions>
  );
}
