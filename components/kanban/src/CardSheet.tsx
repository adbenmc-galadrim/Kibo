import type { Status, StatusId, TicketView } from "@kibo/schema";
import { deliveryMenuActions, StatusDot, useSdk } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@kibo/sdk/ui/sheet";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  type LucideIcon,
  Terminal,
  X,
} from "lucide-react";
import { useState } from "react";
import { fr } from "./fr";

const ROW =
  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-[15px] hover:bg-muted active:bg-muted";

type RowProps = {
  icon?: LucideIcon;
  label: string;
  hint?: string | undefined;
  tone?: string;
  disabled?: boolean;
  onClick(): void;
};

function Row({ icon: Icon, label, hint, tone, disabled = false, onClick }: RowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(ROW, tone, "disabled:cursor-not-allowed disabled:opacity-50")}
      onClick={onClick}
    >
      {Icon && <Icon absoluteStrokeWidth size={18} aria-hidden className="shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-[13px] text-muted-foreground">{hint}</span>}
    </button>
  );
}

type Props = {
  ticket: TicketView;
  statuses: Status[];
  launch: { blocked: string | null } | null;
  onClose(): void;
  onOpen(): void;
  onMove(statusId: StatusId): void;
  onLaunch(): void;
  onRemove(): void;
};

function MoveRows({ ticket, statuses, onMove }: Pick<Props, "ticket" | "statuses" | "onMove">) {
  const [open, setOpen] = useState(false);
  const current = statuses.find((s) => s.id === ticket.statusId)?.label ?? "";
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <>
      <button type="button" aria-expanded={open} className={ROW} onClick={() => setOpen(!open)}>
        <ArrowRight absoluteStrokeWidth size={18} aria-hidden className="shrink-0" />
        <span className="flex-1">{fr.sheet.moveTo}</span>
        <span className="text-[13px] text-muted-foreground">{current}</span>
        <Chevron absoluteStrokeWidth size={16} aria-hidden className="text-muted-foreground" />
      </button>
      {open && (
        <ul aria-label={fr.sheet.moveTo} className="flex flex-col pl-6">
          {statuses
            .filter((s) => s.id !== ticket.statusId)
            .map((s) => (
              <li key={s.id}>
                <button type="button" className={ROW} onClick={() => onMove(s.id)}>
                  <StatusDot statusId={s.id} />
                  <span className="flex-1">{s.id === "blocked" ? `${s.label}…` : s.label}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </>
  );
}

export function CardSheet(props: Props) {
  const { ticket, onClose } = props;
  const sdk = useSdk();
  const act = (run: () => void) => () => {
    onClose();
    run();
  };
  const copies = deliveryMenuActions({ ticket, sdk });
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-1 rounded-t-2xl px-2 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]"
      >
        <span aria-hidden className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/40" />
        <SheetTitle className="flex items-baseline gap-2 px-3 pb-2 text-[15px]">
          <span className="font-mono font-normal text-muted-foreground">{ticket.keyLabel}</span>
          <span className="min-w-0 truncate">{ticket.title}</span>
        </SheetTitle>
        <SheetDescription className="sr-only">{fr.sheet.help}</SheetDescription>
        <MoveRows ticket={ticket} statuses={props.statuses} onMove={(id) => act(() => props.onMove(id))()} />
        {props.launch && (
          <Row
            icon={Terminal}
            label={fr.sheet.launch}
            hint={props.launch.blocked ?? undefined}
            disabled={props.launch.blocked !== null}
            tone="[&_svg]:text-(--tracking-brand)"
            onClick={act(props.onLaunch)}
          />
        )}
        <Row icon={ExternalLink} label={fr.sheet.open} onClick={act(props.onOpen)} />
        {copies.map((c) => (
          <Row key={c.label} icon={c.icon} label={c.label} onClick={act(c.onSelect)} />
        ))}
        <hr className="mx-3 my-1 border-border" />
        {ticket.statusId !== "blocked" && (
          <Row
            icon={Lock}
            label={fr.sheet.block}
            hint={fr.sheet.blockHint}
            onClick={act(() => props.onMove("blocked"))}
          />
        )}
        <Row icon={X} label={fr.sheet.remove} tone="text-destructive" onClick={act(props.onRemove)} />
      </SheetContent>
    </Sheet>
  );
}
