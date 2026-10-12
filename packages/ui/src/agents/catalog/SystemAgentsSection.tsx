import type { AgentSummary, ProjectSummary, RunView } from "@kibo/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { AgentGrid } from "./AgentsSection";

type Props = {
  agents: readonly AgentSummary[];
  projects: readonly ProjectSummary[];
  runs: readonly RunView[];
  onOpen(agent: AgentSummary, rename: boolean): void;
};

const t = frAgentsSkills.page;

export function SystemAgentsSection(props: Props) {
  if (props.agents.length === 0) return null;
  return (
    <Collapsible className="group/system rounded-lg border">
      <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-2 px-4 py-3 text-left text-sm">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 transition-transform group-data-[state=open]/system:rotate-90"
        />
        <span className="font-semibold">{t.system}</span>
        <span className="rounded-full border px-1.5 text-2xs text-muted-foreground">
          {props.agents.length}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {props.agents.map((a) => a.name).join(", ")}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{t.systemHint}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <section aria-label={t.system} className="border-t p-4">
          <AgentGrid {...props} />
        </section>
      </CollapsibleContent>
    </Collapsible>
  );
}
