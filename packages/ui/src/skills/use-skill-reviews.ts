import type { SkillReview } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";

export type ReviewFilter = { skillId: string } | { runId: string };
export type SkillReviewList = { reviews: SkillReview[] | null; failed: boolean; reload(): void };

export function useSkillReviews(filter: ReviewFilter | null): SkillReviewList {
  const [reviews, setReviews] = useState<SkillReview[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useRef(() => {});
  const skillId = filter && "skillId" in filter ? filter.skillId : null;
  const runId = filter && "runId" in filter ? filter.runId : null;

  useEffect(() => {
    if (skillId === null && runId === null) return;
    let alive = true;
    const fetchList = () =>
      client
        .rpc({ method: "skillReviews.list", ...(skillId ? { skillId } : {}), ...(runId ? { runId } : {}) })
        .then(
          (list) => {
            if (!alive) return;
            setReviews(list);
            setFailed(false);
          },
          () => alive && setFailed(true),
        );
    load.current = () => void fetchList();
    void fetchList();
    const off = client.subscribeTopic("skills", () => void fetchList());
    return () => {
      alive = false;
      off();
    };
  }, [skillId, runId]);

  const reload = useCallback(() => load.current(), []);
  return { reviews, failed, reload };
}
