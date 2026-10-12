import type { AgentSettingsPatch, ProjectSummary, Skill, SkillsRule } from "@kibo/schema";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Input } from "@kibo/sdk/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { Info } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { client } from "../../api";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { projectName } from "../catalog/agent-labels";
import { FoldSection } from "./FoldSection";

type Props = {
  rule: SkillsRule;
  preloaded: readonly string[];
  projectId: string | null;
  projects: readonly ProjectSummary[];
  disabled: boolean;
  onPatch(patch: AgentSettingsPatch): void;
};

type Group = { title: string; skills: Skill[] };
const t = frAgentsSkills.skills;

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function skillGroups(
  skills: readonly Skill[],
  query: string,
  projects: readonly ProjectSummary[],
): Group[] {
  const q = plain(query.trim());
  const shown = skills.filter((s) => q === "" || plain(`${s.id} ${s.name} ${s.description}`).includes(q));
  const of = (source: Skill["source"]) => shown.filter((s) => s.source === source);
  const projectIds = [...new Set(of("project").map((s) => s.projectId))];
  return [
    { title: t.computer, skills: of("user") },
    ...projectIds.map((id) => ({
      title: t.project(projectName(id, projects)),
      skills: of("project").filter((s) => s.projectId === id),
    })),
    { title: t.plugins, skills: of("plugin") },
  ].filter((g) => g.skills.length > 0);
}

function useSkillList(projectId: string | null): { skills: Skill[]; failed: boolean } {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    client.rpc({ method: "skills.list", ...(projectId ? { projectId } : {}) }).then(
      (list) => alive && setSkills(list.skills),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [projectId]);
  return { skills, failed };
}

export function SkillsField({ rule, preloaded, projectId, projects, disabled, onPatch }: Props) {
  const id = useId();
  const { skills, failed } = useSkillList(projectId);
  const [query, setQuery] = useState("");
  const ids = rule.mode === "list" ? rule.ids : [];
  const summary = rule.mode === "all" ? t.allSummary : t.listSummary(ids);
  const groups = skillGroups(skills, query, projects);
  const toggle = (id: string, on: boolean) =>
    onPatch({ skills: { mode: "list", ids: on ? [...ids, id] : ids.filter((x) => x !== id) } });
  return (
    <FoldSection title={t.title} summary={summary}>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={t.mode}
        className="w-fit"
        value={rule.mode}
        disabled={disabled}
        onValueChange={(v) => {
          if (v === "all") onPatch({ skills: { mode: "all" } });
          if (v === "list") onPatch({ skills: { mode: "list", ids } });
        }}
      >
        <ToggleGroupItem value="all" className="px-3 text-xs">
          {t.all}
        </ToggleGroupItem>
        <ToggleGroupItem value="list" className="px-3 text-xs">
          {t.list}
        </ToggleGroupItem>
      </ToggleGroup>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t.loadFailed}
        </p>
      )}
      {rule.mode === "list" && (
        <fieldset aria-label={t.title} className="grid gap-3">
          <Input
            type="search"
            aria-label={t.search}
            placeholder={t.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {groups.map((g) => (
            <div key={g.title} className="grid gap-2">
              <p className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">{g.title}</p>
              {g.skills.map((s) => (
                <div key={s.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5">
                  <Checkbox
                    id={`${id}-${s.id}`}
                    aria-label={s.id}
                    className="mt-0.5"
                    checked={ids.includes(s.id)}
                    disabled={disabled}
                    onCheckedChange={(v) => toggle(s.id, v === true)}
                  />
                  <label htmlFor={`${id}-${s.id}`} className="font-mono text-sm font-medium">
                    {s.id}
                  </label>
                  <span className="col-start-2 text-xs text-muted-foreground">{s.description}</span>
                </div>
              ))}
            </div>
          ))}
          {groups.length === 0 && <p className="text-xs text-muted-foreground">{t.empty}</p>}
        </fieldset>
      )}
      {preloaded.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Info aria-hidden className="size-3.5" />
          {t.preloaded}
          <code className="font-mono text-foreground">{preloaded.join(", ")}</code>
          {t.preloadedHelp}
        </p>
      )}
    </FoldSection>
  );
}
