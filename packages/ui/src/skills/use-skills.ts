import type { Skill } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";

export type SkillsList = { skills: Skill[] | null; partialWatch: boolean; error: unknown; reload(): void };

export function useSkills(projectId: string | null): SkillsList {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [partialWatch, setPartialWatch] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const load = useRef(() => {});

  useEffect(() => {
    let alive = true;
    const fetchList = () =>
      client.rpc({ method: "skills.list", ...(projectId ? { projectId } : {}) }).then(
        (list) => {
          if (!alive) return;
          setSkills(list.skills);
          setPartialWatch(list.partialWatch);
          setError(null);
        },
        (e: unknown) => alive && setError(e),
      );
    load.current = () => void fetchList();
    void fetchList();
    const off = client.subscribeTopic("skills", () => void fetchList());
    return () => {
      alive = false;
      off();
    };
  }, [projectId]);

  const reload = useCallback(() => load.current(), []);
  return { skills, partialWatch, error, reload };
}
