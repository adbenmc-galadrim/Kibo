import { WorktreeRecipe } from "@kibo/schema";
import { frDeliverySettings } from "../i18n/fr-delivery-settings";

export type RecipeDraft = {
  copy: string;
  copyFrom: string;
  envFile: string;
  ports: string;
  from: string;
  step: string;
  count: string;
  after: string;
};
export type RecipeResult = { value: WorktreeRecipe | null; problem: string | null };

const errors = frDeliverySettings.recipe.errors;
const PORT_LINE = /^([^=\s]+)\s*=\s*(\d+)$/;

const linesOf = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

export function draftOf(recipe: WorktreeRecipe | null): RecipeDraft {
  const ports = recipe?.env?.ports ?? null;
  return {
    copy: (recipe?.copy ?? []).join("\n"),
    copyFrom: (recipe?.copyFrom ?? []).join("\n"),
    envFile: recipe?.env?.file ?? "",
    ports: Object.entries(ports?.keys ?? {})
      .map(([key, base]) => `${key}=${base}`)
      .join("\n"),
    from: String(ports?.from ?? 1),
    step: String(ports?.step ?? 10),
    count: String(ports?.count ?? 50),
    after: (recipe?.after ?? []).join("\n"),
  };
}

function portKeys(text: string): Record<string, number> | null {
  const keys: Record<string, number> = {};
  for (const line of linesOf(text)) {
    const match = PORT_LINE.exec(line);
    if (!match?.[1] || !match[2]) return null;
    keys[match[1]] = Number(match[2]);
  }
  return keys;
}

function problemOf(path: readonly PropertyKey[]): string {
  const [top, second, third] = path;
  if (top === "copy") return errors.copy;
  if (top === "copyFrom") return errors.copyFrom;
  if (top === "after") return errors.after;
  if (second === "file") return errors.envFile;
  if (third === "from" || third === "step" || third === "count") return errors.numbers;
  return errors.ports;
}

export function recipeOf(draft: RecipeDraft, previous: WorktreeRecipe | null): RecipeResult {
  const keys = portKeys(draft.ports);
  if (keys === null) return { value: null, problem: errors.ports };
  const hasPorts = Object.keys(keys).length > 0;
  const file = draft.envFile.trim();
  if (hasPorts && file === "") return { value: null, problem: errors.envFile };
  const env =
    file === ""
      ? null
      : {
          file,
          ports: hasPorts
            ? { keys, from: Number(draft.from), step: Number(draft.step), count: Number(draft.count) }
            : null,
          replace: previous?.env?.replace ?? {},
          set: previous?.env?.set ?? {},
        };
  const candidate = {
    copyFrom: linesOf(draft.copyFrom),
    copy: linesOf(draft.copy),
    env,
    after: linesOf(draft.after),
  };
  const empty =
    candidate.copyFrom.length === 0 &&
    candidate.copy.length === 0 &&
    env === null &&
    candidate.after.length === 0;
  if (empty) return { value: null, problem: null };
  const parsed = WorktreeRecipe.safeParse(candidate);
  if (parsed.success) return { value: parsed.data, problem: null };
  return { value: null, problem: problemOf(parsed.error.issues[0]?.path ?? []) };
}
