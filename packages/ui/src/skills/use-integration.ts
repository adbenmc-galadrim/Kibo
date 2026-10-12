import type { Skill } from "@kibo/schema";
import { useState } from "react";
import { client } from "../api";
import type { FileEditor } from "../file-editor/use-file-editor";
import { frSkills } from "../i18n/fr-skills";
import { errorMessage } from "../lib/error-message";
import { skillAddress } from "./skill-sections";

export type Integration = {
  saving: boolean;
  error: string | null;
  save(content: string, reviewId: string): Promise<void>;
};

export function useIntegration(
  skill: Skill,
  editor: FileEditor,
  onReviewed: (reviewId: string | null) => void,
): Integration {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (content: string, reviewId: string) => {
    setSaving(true);
    setError(null);
    try {
      const result = await client.rpc({
        method: "skills.save",
        ...skillAddress(skill),
        content,
        baseHash: editor.baseHash,
        reviewId,
      });
      if (!result.ok) {
        setError(frSkills.integrate.conflict);
        return;
      }
      await editor.reload();
      onReviewed(reviewId);
    } catch (e) {
      setError(errorMessage(e) || frSkills.integrate.failed);
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, save };
}
