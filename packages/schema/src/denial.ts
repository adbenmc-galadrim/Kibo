export type DenialReason = "ok" | "shell" | "mcp" | "unknown";
export type DenialItem = {
  tool: string;
  target: string;
  rule: string | null;
  addDir: string | null;
  reason: DenialReason;
};
export type RunDenials = {
  runId: string;
  turn: number;
  items: DenialItem[];
  questionId: string | null;
  at: number;
};

const quoted = (values: readonly string[]): string => values.map((v) => `\`${v}\``).join(", ");

const named = (values: readonly string[], one: string, many: string): string[] =>
  values.length === 0 ? [] : [`${values.length === 1 ? one : many} ${quoted(values)}`];

export const RESUME_AFTER_ALLOW = (rules: readonly string[], dirs: readonly string[]): string => {
  const parts = [...named(rules, "la règle", "les règles"), ...named(dirs, "le dossier", "les dossiers")];
  const several = rules.length + dirs.length > 1;
  const agreed = `autorisé${dirs.length > 0 ? "" : "e"}${several ? "s" : ""}`;
  return `Kibo : ${parts.join(" et ")} ${several ? "sont" : "est"} maintenant ${agreed}. Reprends là où tu t'es arrêté, sans refaire ce qui est déjà fait.`;
};
