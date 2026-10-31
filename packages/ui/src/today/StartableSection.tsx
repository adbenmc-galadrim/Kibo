import { deliveryBrief } from "@kibo/schema";
import { copyDeliveryCommand } from "@kibo/sdk";
import { LaunchInT3Button } from "@kibo/sdk/t3";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Ellipsis, Play } from "lucide-react";
import { toast } from "sonner";
import { ShellT3Provider } from "../shell/ShellT3Provider";
import { frToday as t } from "./fr-today";
import { ProjectKey, SectionLine, SectionList } from "./SectionList";
import type { TodayStartable } from "./today-model";

const LIMIT = 8;
const toaster = { toast: (message: string) => void toast(message) };

function RowMenu({ row }: { row: TodayStartable }) {
  const { key, startable, waitingOn, startReason, keyLabel } = row.ticket;
  if (key === null) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="-mx-[5px] size-6 text-(--tracking-dim)"
          aria-label={t.startable.actions(keyLabel)}
        >
          <Ellipsis aria-hidden className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => void copyDeliveryCommand(toaster, { key, startable, waitingOn, startReason })}
        >
          {t.startable.copy(deliveryBrief(key))}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const featureText = ({ feature }: TodayStartable): string =>
  feature === null ? t.startable.noFeature : t.startable.feature(feature.label, feature.title);

type Props = {
  rows: readonly TodayStartable[];
  onOpenTicket(projectId: string, ticketId: string): void;
};

export function StartableSection({ rows, onOpenTicket }: Props) {
  return (
    <ShellT3Provider>
      <SectionList
        icon={Play}
        title={t.startable.title}
        count={rows.length}
        aside={rows.every((r) => r.free) ? t.startable.aside : null}
        limit={LIMIT}
      >
        {rows.map((row) => (
          <SectionLine
            key={`${row.projectId}/${row.ticket.id}`}
            dot="green"
            label={row.ticket.keyLabel}
            labelWidth={64}
            title={row.ticket.title}
            onOpen={() => onOpenTicket(row.projectId, row.ticket.id)}
          >
            <span className="shrink-0 text-xs text-(--tracking-mfg)">{featureText(row)}</span>
            <ProjectKey value={row.projectKey} />
            <span className="relative z-10 flex items-center gap-2.5">
              <LaunchInT3Button
                projectId={row.projectId}
                ticketKey={row.ticket.keyLabel}
                done={false}
                thread={row.ticket.thread}
                folderMissing={row.folderMissing}
                variant="inline"
                size="xs"
              />
              <RowMenu row={row} />
            </span>
          </SectionLine>
        ))}
      </SectionList>
    </ShellT3Provider>
  );
}
