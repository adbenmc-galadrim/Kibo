import { type AgentExecution, deliveryBrief } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Copy, Truck } from "lucide-react";
import { useState } from "react";
import { DeliverChildrenDialog } from "../../delivery/lazy";
import { useDeliver } from "../../delivery/use-deliver";
import { frFeature as t } from "../../i18n/fr-group";
import { STROKE } from "./styles";

type Step = { ticketId: string; key: string; title: string; blockedBy: readonly string[] };
type Props = { projectId: string; step: Step; execution: AgentExecution };

const BUTTON =
  "h-[25px] gap-[6px] rounded-[6px] bg-primary dark:bg-(--tracking-fg) px-[10px] py-[5px] has-[>svg]:px-[10px] text-[12.5px] leading-[15px] font-medium text-primary-foreground shadow-none hover:bg-primary/90 dark:hover:bg-(--tracking-fg)/90 [&_svg:not([class*='size-'])]:size-[13px]";

export function NextStepAction({ projectId, step, execution }: Props) {
  const command = deliveryBrief(step.key);
  const flow = useDeliver(projectId, { id: step.ticketId, keyLabel: step.key, title: step.title });
  const [copy, setCopy] = useState<"idle" | "copied" | "refused">("idle");
  const run = async () => {
    if (execution === "shown") return flow.deliver();
    try {
      await navigator.clipboard.writeText(command);
      setCopy("copied");
    } catch (e) {
      console.warn("[kibo] clipboard write refused", e);
      setCopy("refused");
    }
  };
  const error = flow.error ?? (copy === "refused" ? t.copyRefused : null);
  return (
    <div className="flex min-h-[29px] flex-wrap items-center gap-[8px] pt-[4px]">
      <p className="text-[12px] leading-[15px] text-(--tracking-mfg)">{t.nextStep(step.blockedBy)}</p>
      <Button className={`ml-auto ${BUTTON}`} disabled={flow.busy} onClick={() => void run()}>
        {execution === "shown" ? <Truck /> : <Copy />}
        {t.deliverNext}
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
      {flow.children && (
        <DeliverChildrenDialog
          projectId={projectId}
          parent={flow.children.parent}
          items={flow.children.items}
          onClose={flow.closeChildren}
        />
      )}
    </div>
  );
}
