import type { TicketView } from "@kibo/schema";
import { CircleCheck, ClockAlert, type LucideIcon, Package } from "lucide-react";
import type { ReactNode } from "react";
import { frFeature as t } from "../../i18n/fr-group";
import { TicketTitle } from "../../ticket/TicketTitle";
import type { TicketCommand } from "../../ticket/use-ticket-command";
import type { FeatureBadge, StepModel } from "./feature-model";
import { SprintChip } from "./SprintChip";
import { STEP_SEGMENT } from "./styles";

type Props = {
  feature: TicketView;
  sprintCode: string | null;
  badge: FeatureBadge;
  steps: readonly StepModel[];
  editable: boolean;
  command: TicketCommand;
  actions?: ReactNode;
};

const BADGES: Record<NonNullable<FeatureBadge>, { icon: LucideIcon | null; tone: string }> = {
  late: { icon: ClockAlert, tone: "bg-(--tracking-red-soft) text-(--tracking-red)" },
  blocked: { icon: null, tone: "bg-(--tracking-red-soft) text-(--tracking-red)" },
  open: { icon: null, tone: "bg-(--tracking-blue-soft) text-(--tracking-blue)" },
  delivered: { icon: CircleCheck, tone: "bg-(--tracking-green-soft) text-(--tracking-green)" },
};

function Badge({ badge }: { badge: FeatureBadge }) {
  if (!badge) return null;
  const { icon: Icon, tone } = BADGES[badge];
  return (
    <span className={`flex h-[17px] shrink-0 items-center gap-[4px] rounded-[4px] px-[6px] py-[2px] ${tone}`}>
      {Icon && <Icon aria-hidden className="size-[12px]" />}
      <span className="text-[10.5px] leading-[13px] font-medium">{t.badges[badge]}</span>
    </span>
  );
}

function StepsBar({ steps }: { steps: readonly StepModel[] }) {
  const done = steps.filter((s) => s.statusId === "done").length;
  return (
    <div className="flex h-[16px] items-center gap-[12px]">
      <span role="img" aria-label={t.stepsBar} className="flex items-center gap-[4px]">
        {steps.map((s) => (
          <span
            key={s.ticketId}
            data-step={s.statusId}
            className={`h-[8px] w-[40px] rounded-[1.5px] ${STEP_SEGMENT[s.statusId] ?? "bg-(--tracking-border)"}`}
          />
        ))}
      </span>
      <span className="text-[13px] leading-[16px] text-(--tracking-mfg)">
        {t.stepsDelivered(done, steps.length)}
      </span>
    </div>
  );
}

export function FeatureHeader({ feature, sprintCode, badge, steps, editable, command, actions }: Props) {
  return (
    <>
      <div className="flex h-[17px] w-full items-center gap-[8px]">
        <Package aria-hidden className="size-[14px] shrink-0 text-(--tracking-mfg)" />
        <p className="shrink-0 text-[12px] leading-[15px] text-(--tracking-mfg)">
          {t.kicker(feature.shortKey, feature.keyLabel)}
        </p>
        {sprintCode && <SprintChip code={sprintCode} />}
        <Badge badge={badge} />
        {actions && <span className="ml-auto flex items-center">{actions}</span>}
      </div>
      <h1 className="text-[26px] leading-[32px] font-semibold tracking-[-0.4px] text-(--tracking-fg)">
        <TicketTitle
          title={feature.title}
          editable={editable}
          error={command.error}
          onSave={(title) => command.run({ method: "updateTicket", ticketId: feature.id, title })}
          onCancel={command.clearError}
        />
      </h1>
      <StepsBar steps={steps} />
    </>
  );
}
