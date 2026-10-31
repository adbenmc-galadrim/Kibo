import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { frToday as t } from "./fr-today";

type Props = { summary: string | null; onNewProject(): void };

export function TodayHeader({ summary, onNewProject }: Props) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="grid gap-1">
        <h1 className="text-(length:--tracking-text-title) font-semibold leading-[1.2]">{t.title}</h1>
        {summary !== null && <p className="text-[12.5px] leading-[1.2] text-(--tracking-mfg)">{summary}</p>}
      </div>
      <span className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        className="h-[26px] gap-1.5 px-2.5 text-xs [&_svg]:size-[13px]"
        onClick={onNewProject}
      >
        <Plus aria-hidden />
        {t.newProject}
      </Button>
    </div>
  );
}
