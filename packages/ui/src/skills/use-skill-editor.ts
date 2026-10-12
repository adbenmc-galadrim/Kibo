import type { Skill } from "@kibo/schema";
import { useEffect, useRef, useState } from "react";
import { client } from "../api";
import { type FileEditor, useFileEditor } from "../file-editor/use-file-editor";
import {
  composeSkillText,
  fieldsOf,
  SKILL_FILE,
  type SkillFields,
  type SkillText,
  sameFields,
  splitSkillText,
} from "./skill-file-text";
import { skillAddress } from "./skill-sections";

export type SkillEditorState = {
  editor: FileEditor;
  main: boolean;
  fields: SkillFields;
  setFields(patch: Partial<SkillFields>): void;
  dirty: boolean;
  text(): string;
  setReview(id: string | null): void;
};

const EMPTY: SkillText = { prefix: "", body: "" };

export function useSkillEditor(
  skill: Skill,
  file: string,
  onSaved: (reviewId: string | null) => void,
): SkillEditorState {
  const main = file === SKILL_FILE;
  const address = skillAddress(skill);
  const [fields, setFieldsState] = useState<SkillFields>(() => fieldsOf(skill.file));
  const [savedFields, setSavedFields] = useState<SkillFields>(fields);
  const split = useRef<SkillText>(EMPTY);
  const latest = useRef({ skill, fields, savedFields, onSaved });
  latest.current = { skill, fields, savedFields, onSaved };
  const review = useRef<string | null>(null);
  const target = main ? {} : { file };

  const compose = (body: string) => {
    const { fields: now, savedFields: before, skill: current } = latest.current;
    const changed = main && !sameFields(now, before);
    return composeSkillText({ ...split.current, body, fields: changed ? now : null, file: current.file });
  };

  const editor = useFileEditor({
    topic: "skills",
    read: async () => {
      const read = await client.rpc({ method: "skills.read", ...address, ...target });
      split.current = main ? splitSkillText(read.content) : { prefix: "", body: read.content };
      return { content: split.current.body, hash: read.hash };
    },
    save: async (body, baseHash) => {
      const content = compose(body);
      const reviewId = review.current;
      const result = await client.rpc({
        method: "skills.save",
        ...address,
        ...target,
        content,
        baseHash,
        ...(reviewId ? { reviewId } : {}),
      });
      if (!result.ok) return result;
      split.current = main ? splitSkillText(content) : { prefix: "", body: content };
      setSavedFields(latest.current.fields);
      review.current = null;
      latest.current.onSaved(reviewId ?? null);
      return { ok: true, value: { hash: result.value.hash } };
    },
  });

  useEffect(() => {
    if (editor.revision === 0) return;
    const fresh = fieldsOf(latest.current.skill.file);
    setFieldsState(fresh);
    setSavedFields(fresh);
  }, [editor.revision]);

  return {
    editor,
    main,
    fields,
    setFields: (patch) => setFieldsState((f) => ({ ...f, ...patch })),
    dirty: editor.dirty || (main && !sameFields(fields, savedFields)),
    text: () => compose(editor.content),
    setReview: (id) => {
      review.current = id;
    },
  };
}
