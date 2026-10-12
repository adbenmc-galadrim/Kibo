import { AgentName } from "./agent";

export const MODEL_ALIASES = ["opus", "sonnet", "haiku", "fable", "claude"] as const;
export const MEANINGLESS_NAMES = [
  "agent",
  "test",
  "nouveau-agent",
  "new-agent",
  "mon-agent",
  "my-agent",
  "bot",
] as const;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 200;
const SUGGESTION_MAX = 40;
const SUGGESTION_WORDS = 3;

const STOP_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "d",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "et",
  "l",
  "la",
  "le",
  "les",
  "ou",
  "par",
  "pour",
  "sur",
  "un",
  "une",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const INVALID = "Nom invalide : minuscules, chiffres et tirets, 64 caractères au plus (review-pr)";
const VAGUE = "Nom peu parlant : dis ce que fait l'agent (review-pr, livraison-front)";

const isMeaningless = (name: string): boolean =>
  MEANINGLESS_NAMES.some((vague) => new RegExp(`^${vague}(-?\\d+)?$`).test(name));
const startsWithModel = (name: string): boolean =>
  MODEL_ALIASES.some((alias) => name.split("-")[0] === alias);

export function agentNameProblem(name: string): string | null {
  if (!AgentName.safeParse(name).success) return INVALID;
  return isMeaningless(name) || startsWithModel(name) ? VAGUE : null;
}

const plain = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function suggestAgentName(description: string): string {
  const words = plain(description)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));
  return words.slice(0, SUGGESTION_WORDS).join("-").slice(0, SUGGESTION_MAX).replace(/-+$/, "");
}

export function descriptionProblem(description: string): string | null {
  const text = description.trim();
  if (text.includes("\n")) return "Une seule phrase, sur une ligne";
  if (text.length < DESCRIPTION_MIN || text.length > DESCRIPTION_MAX) {
    return `Une phrase de ${DESCRIPTION_MIN} à ${DESCRIPTION_MAX} caractères qui dit ce que fait l'agent et quand l'appeler`;
  }
  return null;
}

export const claudeCodePreview = (name: string, description: string): string =>
  `Dans Claude Code : \`${name}\` — ${description}`;
