import type { AgentRef, SkillSuggestion } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export function useSkillSuggestions(
  agentRef: AgentRef | null,
  projectId: string | null,
  enabled: boolean,
): SkillSuggestion[] | null {
  const [skills, setSkills] = useState<SkillSuggestion[] | null>(null);

  useEffect(() => {
    setSkills(null);
    if (!enabled || agentRef === null) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await client.rpc({
          method: "skills.suggest",
          agentRef,
          ...(projectId ? { projectId } : {}),
        });
        if (alive) setSkills(r.skills);
      } catch (e) {
        console.error("[kibo-ui] skill suggestions failed", e);
      }
    };
    void load();
    const off = client.subscribeTopic("skills", () => void load());
    return () => {
      alive = false;
      off();
    };
  }, [agentRef, projectId, enabled]);

  return skills;
}
