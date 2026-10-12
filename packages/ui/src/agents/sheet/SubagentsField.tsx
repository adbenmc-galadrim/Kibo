import type { Agent, AgentRef, AgentSettingsPatch, AgentSummary, ProjectSummary } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { useId } from "react";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { scopeText } from "../catalog/agent-labels";
import { FoldSection } from "./FoldSection";

type Props = {
  agent: Agent;
  agents: readonly AgentSummary[];
  projects: readonly ProjectSummary[];
  disabled: boolean;
  onPatch(patch: AgentSettingsPatch): void;
};

const t = frAgentsSkills.subagents;

export function callableAgents(
  agent: Pick<Agent, "ref" | "scope" | "projectId">,
  agents: readonly AgentSummary[],
) {
  return agents.filter(
    (a) =>
      a.ref !== agent.ref &&
      (a.scope === "global" ||
        (agent.scope === "project" && a.scope === "project" && a.projectId === agent.projectId)),
  );
}

function summaryOf(agent: Agent, names: readonly string[]): string {
  const generic = agent.settings.genericSubagents;
  if (names.length === 0) return generic ? `${t.none} · ${t.genericAllowed}` : t.none;
  return generic ? `${names.join(", ")} · ${t.genericShort}` : names.join(", ");
}

export function SubagentsField({ agent, agents, projects, disabled, onPatch }: Props) {
  const id = useId();
  const callable = callableAgents(agent, agents);
  const chosen = new Set(agent.settings.subagents);
  const names = callable.filter((a) => chosen.has(a.ref)).map((a) => a.name);
  const toggle = (ref: AgentRef, on: boolean) => {
    const next = on ? [...agent.settings.subagents, ref] : agent.settings.subagents.filter((r) => r !== ref);
    onPatch({ subagents: next });
  };
  return (
    <FoldSection
      title={t.title}
      summary={`${t.count(chosen.size, callable.length)} · ${summaryOf(agent, names)}`}
    >
      <fieldset aria-label={t.title} className="grid gap-3">
        {callable.length === 0 && <p className="text-xs text-muted-foreground">{t.empty}</p>}
        {callable.map((a) => {
          const unreadable = a.problem !== null;
          return (
            <div key={a.ref} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5">
              <Checkbox
                id={`${id}-${a.ref}`}
                aria-label={a.name}
                className="mt-0.5"
                checked={chosen.has(a.ref)}
                disabled={disabled || unreadable}
                onCheckedChange={(v) => toggle(a.ref, v === true)}
              />
              <label htmlFor={`${id}-${a.ref}`} className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-sm font-medium">{a.name}</span>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {scopeText(a, projects)}
                </Badge>
              </label>
              <span className="col-start-2 text-xs text-muted-foreground">
                {unreadable ? t.unreadable : a.description}
              </span>
            </div>
          );
        })}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 border-t pt-3">
          <Checkbox
            id={`${id}-generic`}
            aria-label={t.generic}
            className="mt-0.5"
            checked={agent.settings.genericSubagents}
            disabled={disabled}
            onCheckedChange={(v) => onPatch({ genericSubagents: v === true })}
          />
          <label htmlFor={`${id}-generic`} className="flex flex-wrap items-baseline gap-2 text-sm">
            {t.generic}
            <span className="font-mono text-xs text-muted-foreground">{t.genericNames}</span>
          </label>
          <span className="col-start-2 text-xs text-muted-foreground">
            {agent.scope === "project" ? t.helpProject : t.helpGlobal}
          </span>
        </div>
      </fieldset>
    </FoldSection>
  );
}
