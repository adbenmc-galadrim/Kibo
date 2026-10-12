import type { ProjectSummary, Skill, SkillReview } from "@kibo/schema";
import { useState } from "react";
import { client } from "../api";
import { frSkills } from "../i18n/fr-skills";
import { CopySkillDialog } from "./CopySkillDialog";
import { SkillWorkspace } from "./SkillWorkspace";
import { SKILL_FILE } from "./skill-file-text";
import { useSkillReviews } from "./use-skill-reviews";

type Props = {
  skill: Skill;
  projects: ProjectSummary[];
  carried: SkillReview | null;
  onBack(): void;
  onOpenSkill(skill: Skill, carried?: SkillReview | null): void;
};

export type ReviewFocus = { review: SkillReview; mode: "integrate" | "pinned" };

const focusOf = (review: SkillReview | null): ReviewFocus | null =>
  review ? { review, mode: review.suggestion !== null ? "integrate" : "pinned" } : null;

export function SkillEditor({ skill, projects, carried, onBack, onOpenSkill }: Props) {
  const list = useSkillReviews({ skillId: skill.id });
  const [carriedOpen, setCarriedOpen] = useState(carried?.status === "new");
  const reviews = [...(carried && carriedOpen ? [carried] : []), ...(list.reviews ?? [])];
  const [file, setFile] = useState(SKILL_FILE);
  const [notesOpen, setNotesOpen] = useState(carried !== null);
  const [focus, setFocus] = useState<ReviewFocus | null>(() => focusOf(carried));
  const [copying, setCopying] = useState<SkillReview | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const ignore = async (review: SkillReview) => {
    setFailed(null);
    try {
      await client.rpc({ method: "skillReviews.decide", id: review.id, decision: "ignore" });
      if (focus?.review.id === review.id) setFocus(null);
      list.reload();
    } catch {
      setFailed(frSkills.reviews.ignoreFailed);
    }
  };
  const focusOn = (review: SkillReview, mode: ReviewFocus["mode"]) => {
    setFile(SKILL_FILE);
    setFocus({ review, mode });
  };
  return (
    <>
      <SkillWorkspace
        key={file}
        skill={skill}
        file={file}
        projects={projects}
        reviews={reviews}
        notesOpen={notesOpen}
        focus={focus}
        notice={failed}
        onBack={onBack}
        onFile={setFile}
        onNotes={() => setNotesOpen((o) => !o)}
        onFocus={setFocus}
        onIntegrate={(review) => focusOn(review, "integrate")}
        onOpenReview={(review) => focusOn(review, "pinned")}
        onIgnore={(review) => void ignore(review)}
        onCopy={setCopying}
        onReviewed={(reviewId) => {
          if (reviewId === carried?.id) setCarriedOpen(false);
          setFocus(null);
          list.reload();
        }}
      />
      {copying !== undefined && (
        <CopySkillDialog
          skill={skill}
          projects={projects}
          onClose={() => setCopying(undefined)}
          onCopied={(copy) => onOpenSkill(copy, copying)}
        />
      )}
    </>
  );
}
