import { describe, expect, test } from "bun:test";
import {
  foldSkillReview,
  isSharedToolName,
  SKILL_REVIEW_SPEC,
  SkillId,
  SkillReviewCall,
  SkillReviewInput,
  type SkillReviewRow,
} from "./skill";

describe("skill ids", () => {
  test("a plain name or a plugin prefix", () => {
    for (const ok of ["brainstorming", "superpowers:brainstorming", "my.skill"]) {
      expect(SkillId.safeParse(ok).success).toBe(true);
    }
    for (const ko of ["Bad", "a:b:c"]) expect(SkillId.safeParse(ko).success).toBe(false);
  });
});

describe("skill reviews", () => {
  test("a note holds three lines and 300 characters at most", () => {
    const review = { skill: "a", verdict: "ok", note: "l1\nl2\nl3" };
    expect(SkillReviewInput.safeParse(review).success).toBe(true);
    expect(SkillReviewInput.safeParse({ ...review, note: "l1\nl2\nl3\nl4" }).success).toBe(false);
    expect(SkillReviewInput.safeParse({ ...review, note: "x".repeat(301) }).success).toBe(false);
    expect(SkillReviewInput.safeParse({ ...review, verdict: "bad" }).success).toBe(false);
    const reviews = Array.from({ length: 21 }, () => review);
    expect(SkillReviewCall.safeParse({ reviews }).success).toBe(false);
    expect(SkillReviewCall.safeParse({ reviews: [review] }).success).toBe(true);
  });

  const row: SkillReviewRow = {
    id: "r1",
    runId: "run",
    runLabel: "bou · review-pr · BOU-1",
    agentName: "review-pr",
    projectId: null,
    ticketId: null,
    ticketKey: null,
    skillId: "a",
    skillPath: null,
    baseHash: null,
    verdict: "improve",
    note: "n",
    suggestion: null,
    createdAt: 1,
  };

  test("folds its events, the first final one wins", () => {
    expect(foldSkillReview(row, [])).toMatchObject({ status: "new", decidedAt: null, versionId: null });
    const by = { kind: "human" as const, ref: "adam" };
    expect(foldSkillReview(row, [{ type: "integrated", by, at: 5, versionId: "v1" }])).toMatchObject({
      status: "integrated",
      decidedAt: 5,
      decidedBy: by,
      versionId: "v1",
    });
    expect(
      foldSkillReview(row, [
        { type: "ignored", by, at: 2, versionId: null },
        { type: "integrated", by, at: 3, versionId: "v2" },
      ]),
    ).toMatchObject({ status: "ignored", decidedAt: 2, versionId: null });
  });

  test("the tool is shared by ticket and project runs", () => {
    expect(SKILL_REVIEW_SPEC.name).toBe("skill_review");
    expect(SKILL_REVIEW_SPEC.inputSchema.required).toEqual(["reviews"]);
    expect(isSharedToolName("skill_review")).toBe(true);
    expect(isSharedToolName("ticket_progress")).toBe(false);
  });
});
