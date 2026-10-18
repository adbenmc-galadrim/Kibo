import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Check, Copy, Flag, type LucideIcon, Map as MapIcon } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "./fr";
import type { GettingStartedModel, StartStep } from "./getting-started-model";
import { CARD, CardHeader, ROW_LINE } from "./parts";

type Props = {
  model: GettingStartedModel;
  projectKey: string;
  onOpenPlanning(): void;
  onCopy(): void;
};

const BUTTON =
  "h-[25px] shrink-0 gap-[6px] rounded-[6px] px-[10px] py-[5px] font-medium text-[12px] shadow-none has-[>svg]:px-[10px]";
const t = fr.start;

function Action({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick(): void }) {
  return (
    <Button variant="outline" className={BUTTON} onClick={onClick}>
      <Icon absoluteStrokeWidth size={13} />
      {label}
    </Button>
  );
}

function Step({
  step,
  done,
  title,
  text,
  aside,
}: {
  step: StartStep;
  done: boolean;
  title: ReactNode;
  text: string;
  aside: ReactNode;
}) {
  return (
    <li
      data-step={step}
      data-done={String(done)}
      className={cn("flex items-start gap-[12px] px-[16px] py-[14px]", ROW_LINE)}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full border",
          done
            ? "border-(--tracking-green) bg-(--tracking-green) text-(--tracking-card)"
            : "border-(--tracking-border)",
        )}
      >
        {done && <Check absoluteStrokeWidth size={12} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <span className="flex h-[17px] items-center gap-[6px] font-medium text-(--tracking-fg) text-[13.5px] leading-[17px]">
          {title}
        </span>
        <span className="text-(--tracking-mfg) text-[12.5px] leading-[18px]">{text}</span>
      </div>
      {aside}
    </li>
  );
}

export function GettingStarted({ model, projectKey, onOpenPlanning, onCopy }: Props) {
  const target = model.target;
  const shown: StartStep[] = target === null ? ["folder", "feature"] : ["folder", "feature", "copy"];
  const count = shown.filter((step) => model.done[step]).length;
  return (
    <section aria-label={t.title} className={CARD}>
      <CardHeader
        icon={Flag}
        title={t.title}
        count={t.count(count, shown.length)}
        aside={
          <span className="text-(--tracking-mfg) text-[12.5px] leading-[15px]">
            {t.subtitle(shown.length)}
          </span>
        }
      />
      <ul>
        <Step
          step="folder"
          done={model.done.folder}
          title={t.folder.title}
          text={t.folder.text}
          aside={
            <span className="shrink-0 text-(--tracking-mfg) text-[12px] leading-[25px]">
              {t.folder.where}
            </span>
          }
        />
        <Step
          step="feature"
          done={model.done.feature}
          title={t.feature.title}
          text={t.feature.text(projectKey)}
          aside={<Action icon={MapIcon} label={t.feature.open} onClick={onOpenPlanning} />}
        />
        {target !== null && (
          <Step
            step="copy"
            done={model.done.copy}
            title={
              <>
                {t.copy.title}
                <code className="font-mono font-normal text-[13px] leading-[16px]">{model.command}</code>
              </>
            }
            text={t.copy.text}
            aside={<Action icon={Copy} label={t.copy.button} onClick={onCopy} />}
          />
        )}
      </ul>
    </section>
  );
}
