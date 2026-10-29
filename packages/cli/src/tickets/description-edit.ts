import { KiboError } from "@kibo/schema";
import { flagText, type Parsed } from "../args";

export const EXCLUSIVE_EDITS = "--description, --append and --prepend are exclusive";

export type DescriptionEdit = { kind: "replace" | "append" | "prepend"; text: string };

const EDIT_FLAGS = [
  ["description", "replace"],
  ["append", "append"],
  ["prepend", "prepend"],
] as const;

export function descriptionEditOf(
  flags: Parsed["flags"],
  read: (raw: string) => string,
): DescriptionEdit | null {
  const given = EDIT_FLAGS.filter(([name]) => flags[name] !== undefined);
  if (given.length > 1) throw new KiboError("INVALID_INPUT", EXCLUSIVE_EDITS);
  const [edit] = given;
  if (edit === undefined) return null;
  const [name, kind] = edit;
  return { kind, text: read(flagText(flags, name) ?? "") };
}

export function editDescription(current: string, edit: DescriptionEdit): string {
  if (edit.kind === "replace" || current.trim() === "") return edit.text;
  if (edit.kind === "append") return `${current.trimEnd()}\n\n${edit.text}`;
  return `${edit.text.trimEnd()}\n\n${current.trimStart()}`;
}
