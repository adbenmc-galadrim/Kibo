export const BUILTIN_IDS = ["kanban", "graph", "mockup", "questions", "planning", "overview"] as const;
const BUILTIN: readonly string[] = BUILTIN_IDS;
export const isBuiltinId = (id: string): boolean => BUILTIN.includes(id);

export const USED_MARKER = "::kibo-used::";
