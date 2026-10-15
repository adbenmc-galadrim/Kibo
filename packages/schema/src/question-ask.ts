import { AskInput } from "./question";
import {
  QUESTION_CONTEXT_MAX,
  QUESTION_OPTION_MAX,
  QUESTION_OPTIONS_MAX,
  QUESTION_TITLE_MAX,
} from "./question-fields";
import { ASK_IMAGE_PATH_MAX, QUESTION_IMAGE_LIMITS } from "./question-image";
import { RECIPIENT_ID_MAX } from "./question-recipient";

const cut = (value: string, max: number): string => value.trim().slice(0, max).trim();

function stringField(input: Record<string, unknown>, key: string): string | null | undefined {
  const value = input[key];
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : null;
}

function toolOptions(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || !raw.every((o): o is string => typeof o === "string")) return null;
  const options = raw.map((o) => cut(o, QUESTION_OPTION_MAX)).filter((o) => o.length > 0);
  return [...new Set(options)].slice(0, QUESTION_OPTIONS_MAX);
}

function toolProvisional(
  raw: string | undefined,
  options: string[],
  blocking: boolean,
): string | null | undefined {
  const provisional = raw === undefined ? "" : cut(raw, QUESTION_OPTION_MAX);
  if (provisional && (options.length === 0 || options.includes(provisional))) return provisional;
  return blocking ? null : undefined;
}

function toolImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is string => typeof p === "string" && p.length > 0 && p.length <= ASK_IMAGE_PATH_MAX)
    .slice(0, QUESTION_IMAGE_LIMITS.count);
}

export function askInputFromTool(
  toolInput: Record<string, unknown> | null,
  blocking: boolean,
): AskInput | null {
  if (toolInput === null || typeof toolInput !== "object") return null;
  const question = stringField(toolInput, "question");
  const context = stringField(toolInput, "context");
  const provisionalRaw = stringField(toolInput, "provisional");
  const options = toolOptions(toolInput.options);
  if (!question || context === null || provisionalRaw === null || options === null) return null;
  const provisional = toolProvisional(provisionalRaw, options, blocking);
  if (provisional === undefined) return null;
  const recipient = stringField(toolInput, "recipient");
  const parsed = AskInput.safeParse({
    title: cut(question, QUESTION_TITLE_MAX),
    context: (context ?? "").slice(0, QUESTION_CONTEXT_MAX),
    options,
    provisional,
    blocking,
    recipient: recipient ? cut(recipient, RECIPIENT_ID_MAX) || null : null,
    kind: toolInput.kind === "validation" ? "validation" : "question",
    images: toolImages(toolInput.images),
  });
  return parsed.success ? parsed.data : null;
}
