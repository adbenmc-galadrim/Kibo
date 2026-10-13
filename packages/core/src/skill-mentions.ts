const ID = "[a-z0-9][a-z0-9:._-]{0,128}";
const LEADING = new RegExp(`^\\/(${ID})(?=\\s|$)`);
const MENTION = new RegExp(`(^|\\s)\\/(${ID})(?=\\s|$)`, "g");

const named = (id: string) => `le skill \`${id}\` (outil Skill)`;

const inline = (text: string, known: ReadonlySet<string>): string =>
  text.replace(MENTION, (all: string, blank: string, id: string) =>
    known.has(id) ? `${blank}${named(id)}` : all,
  );

export function rewriteSkillMentions(text: string, known: ReadonlySet<string>): string {
  const lead = LEADING.exec(text);
  const id = lead?.[1];
  if (lead === null || id === undefined || !known.has(id)) return inline(text, known);
  const rest = inline(text.slice(lead[0].length).trim(), known);
  const instruction = `Utilise le skill \`${id}\` (outil Skill)`;
  return rest === "" ? `${instruction}.` : `${instruction} avec : ${rest}`;
}
