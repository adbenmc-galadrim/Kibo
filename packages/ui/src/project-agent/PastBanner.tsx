import { Button } from "@kibo/sdk/ui/button";
import { ArrowLeft } from "lucide-react";
import { formatClock } from "../agents/format";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { shortDay } from "./agent-list";

type Props = { startedAt: number; onBack(): void };

const t = frProjectAgent.past;

export function PastBanner({ startedAt, onBack }: Props) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-(--tracking-soft) bg-muted/50 px-[18px] py-1.5 text-xs text-muted-foreground">
      <span className="truncate">{t.banner(`${shortDay(startedAt)} ${formatClock(startedAt)}`)}</span>
      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onBack}>
        <ArrowLeft />
        {t.back}
      </Button>
    </div>
  );
}
