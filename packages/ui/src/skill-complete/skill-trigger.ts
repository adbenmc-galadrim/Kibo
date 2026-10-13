export type SkillTrigger = { start: number; query: string };

const WORD = /^[a-z0-9:._-]*$/;
const WORD_CHAR = /[a-z0-9:._-]/;

export function skillTrigger(text: string, caret: number): SkillTrigger | null {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf("/");
  if (start === -1) return null;
  const previous = start === 0 ? "" : (before[start - 1] ?? "");
  if (previous !== "" && !/\s/.test(previous)) return null;
  const query = before.slice(start + 1);
  return WORD.test(query) ? { start, query } : null;
}

function wordEnd(text: string, from: number): number {
  let end = from;
  while (end < text.length && WORD_CHAR.test(text[end] ?? "")) end += 1;
  return end;
}

export function insertSkill(
  text: string,
  trigger: SkillTrigger,
  id: string,
): { text: string; caret: number } {
  const rest = text.slice(wordEnd(text, trigger.start + 1));
  const spaced = /^\s/.test(rest) ? rest : ` ${rest}`;
  const head = `${text.slice(0, trigger.start)}/${id}`;
  return { text: head + spaced, caret: head.length + 1 };
}
