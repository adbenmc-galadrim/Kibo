import {
  type Actor,
  KiboError,
  maskSecretsWithin,
  type RunView,
  SKILL_BODY_MAX,
  SKILL_NOTE_MAX,
  type SkillId,
  type SkillReview,
  SkillReviewCall,
  type SkillReviewInput,
} from "@kibo/schema";
import type { z } from "zod";
import type { SkillReviewStore } from "./reviews-store";
import type { SkillUses } from "./uses-store";

export type SkillReviews = {
  record(run: RunView, input: unknown): Promise<string>;
  list(filter: { skillId?: SkillId; runId?: string }): SkillReview[];
  decide(id: string, decision: "ignore", by: Actor): SkillReview;
  markIntegrated(id: string, versionId: string, by: Actor): SkillReview;
  hasReview(runId: string): boolean;
  store: SkillReviewStore;
};

export type SkillReviewsDeps = {
  store: SkillReviewStore;
  uses: Pick<SkillUses, "byRun">;
  skillPath(id: SkillId): { path: string; hash: string | null } | null;
  emit(topic: "skills"): void;
  now?: () => number;
};

const issueText = (issue: z.ZodIssue): string =>
  issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message;

function parseCall(input: unknown): SkillReviewInput[] {
  const parsed = SkillReviewCall.safeParse(input);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.issues.map(issueText).join("; "));
  return parsed.data.reviews;
}

const recorded = (n: number): string => (n > 1 ? `${n} reviews enregistrées` : "1 review enregistrée");

export function createSkillReviews(deps: SkillReviewsDeps): SkillReviews {
  const now = deps.now ?? Date.now;
  const { store } = deps;

  function assertUsed(run: RunView, reviews: readonly SkillReviewInput[]): void {
    const used = new Set(deps.uses.byRun(run.id).map((u) => u.skillId));
    const unused = reviews.filter((r) => !used.has(r.skill)).map((r) => r.skill);
    if (unused.length > 0)
      throw new KiboError(
        "INVALID_INPUT",
        `skill non utilisé par ce run : ${[...new Set(unused)].join(", ")}`,
      );
  }

  function storeOne(run: RunView, review: SkillReviewInput, at: number): void {
    const target = deps.skillPath(review.skill);
    store.replaceOpen(run.id, review.skill, at);
    store.create({
      runId: run.id,
      runLabel: run.label,
      agentName: run.agentName,
      projectId: run.projectId,
      ticketId: run.ticketId,
      ticketKey: run.ticketKey,
      skillId: review.skill,
      skillPath: target?.path ?? null,
      baseHash: target?.hash ?? null,
      verdict: review.verdict,
      note: maskSecretsWithin(review.note, SKILL_NOTE_MAX),
      suggestion: review.suggestion ? maskSecretsWithin(review.suggestion.content, SKILL_BODY_MAX) : null,
      createdAt: at,
    });
  }

  function decided(review: SkillReview): SkillReview {
    deps.emit("skills");
    return review;
  }

  return {
    async record(run, input) {
      const reviews = parseCall(input);
      assertUsed(run, reviews);
      const at = now();
      for (const review of reviews) storeOne(run, review, at);
      deps.emit("skills");
      return recorded(reviews.length);
    },
    list({ skillId, runId }) {
      if (runId !== undefined) {
        const ofRun = store.byRun(runId);
        return skillId === undefined ? ofRun : ofRun.filter((r) => r.skillId === skillId);
      }
      if (skillId !== undefined) return store.bySkill(skillId);
      throw new KiboError("INVALID_INPUT", "skillId or runId is required");
    },
    decide: (id, _decision, by) =>
      decided(store.appendEvent(id, { type: "ignored", by, at: now(), versionId: null })),
    markIntegrated: (id, versionId, by) =>
      decided(store.appendEvent(id, { type: "integrated", by, at: now(), versionId })),
    hasReview: (runId) => store.byRun(runId).length > 0,
    store,
  };
}
