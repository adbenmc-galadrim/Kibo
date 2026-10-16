import { cn } from "@kibo/sdk/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@kibo/sdk/ui/tabs";
import { CalendarRange } from "lucide-react";
import { ALL_SPRINTS, NO_SPRINT, type SprintRef, sprintCode } from "./filter-tickets";
import { fr } from "./fr";

type Props = { sprints: readonly SprintRef[]; value: string; onChange(value: string): void };

const TAB = cn(
  "h-[23px] flex-none gap-[5px] rounded-[5px] border-transparent px-[9px] py-[3px] text-[12.5px] leading-[1.2] font-medium",
  "text-(--tracking-mfg) hover:text-(--tracking-fg) dark:text-(--tracking-mfg) dark:hover:text-(--tracking-fg)",
  "data-[state=active]:border-(--tracking-border) data-[state=active]:bg-(--tracking-bg) data-[state=active]:text-(--tracking-fg)",
  "dark:data-[state=active]:border-(--tracking-border) dark:data-[state=active]:bg-(--tracking-bg) dark:data-[state=active]:text-(--tracking-fg)",
  "group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none",
);

export function SprintTabs({ sprints, value, onChange }: Props) {
  return (
    <Tabs value={value} onValueChange={onChange} className="gap-0">
      <TabsList
        aria-label={fr.sprints.label}
        className="h-[27px] gap-[2px] rounded-[7px] bg-(--tracking-muted) p-[2px] group-data-[orientation=horizontal]/tabs:h-[27px]"
      >
        <TabsTrigger value={ALL_SPRINTS} className={TAB}>
          {fr.sprints.all}
        </TabsTrigger>
        {sprints.map((s) => (
          <TabsTrigger key={s.id} value={s.id} className={cn(TAB, "font-mono")}>
            {s.state === "current" && (
              <CalendarRange role="img" aria-label={fr.sprints.current} className="size-3" />
            )}
            {sprintCode(s)}
          </TabsTrigger>
        ))}
        <TabsTrigger value={NO_SPRINT} className={TAB}>
          {fr.sprints.none}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
