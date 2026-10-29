import { deliveryBrief, type StartReason } from "@kibo/schema";
import { deliveryTexts } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Copy } from "lucide-react";
import { useState } from "react";
import { frFeature as t } from "../../i18n/fr-group";
import { STROKE } from "./styles";

type Step = { ticketId: string; key: string; title: string; blockedBy: readonly string[] };
type Props = { step: Step; reason: StartReason | null };

const BUTTON =
  "h-[25px] gap-[6px] rounded-[6px] bg-primary dark:bg-(--tracking-fg) px-[10px] py-[5px] has-[>svg]:px-[10px] text-[12.5px] leading-[15px] font-medium text-primary-foreground shadow-none hover:bg-primary/90 dark:hover:bg-(--tracking-fg)/90 [&_svg:not([class*='size-'])]:size-[13px]";

const TEXT = "text-[12px] leading-[15px] text-(--tracking-mfg)";

function WaitingStep({ step, reason }: { step: Step; reason: StartReason }) {
  const said = deliveryTexts.reason(reason);
  return (
    <div className="flex min-h-[29px] flex-wrap items-center gap-[8px] pt-[4px]">
      <p className={TEXT}>{said === null ? t.noStartableStep : t.nextStepWaits(step.key, said)}</p>
    </div>
  );
}

export function NextStepAction({ reason, ...props }: Props) {
  return reason === null ? <StartableStep {...props} /> : <WaitingStep step={props.step} reason={reason} />;
}

function StartableStep({ step }: Omit<Props, "reason">) {
  const command = deliveryBrief(step.key);
  const [copy, setCopy] = useState<"idle" | "copied" | "refused">("idle");
  const run = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopy("copied");
    } catch (e) {
      console.warn("[kibo] clipboard write refused", e);
      setCopy("refused");
    }
  };
  const error = copy === "refused" ? t.copyRefused : null;
  return (
    <div className="flex min-h-[29px] flex-wrap items-center gap-[8px] pt-[4px]">
      <p className={TEXT}>{t.nextStep(step.blockedBy)}</p>
      <Button className={`ml-auto ${BUTTON}`} onClick={() => void run()}>
        <Copy absoluteStrokeWidth size={13} />
        {t.copyCommand}
      </Button>
      <code
        className={`flex h-[24px] items-center rounded-[6px] px-[9px] font-mono text-[11.5px] leading-[14px] text-(--tracking-mfg) ${STROKE}`}
      >
        {command}
      </code>
      <output className="sr-only">{copy === "copied" ? t.copied : ""}</output>
      {error && (
        <p role="alert" className="basis-full text-[12px] leading-[15px] text-(--tracking-red)">
          {error}
        </p>
      )}
    </div>
  );
}
