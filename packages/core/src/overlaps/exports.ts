import { DUPLICATION_LIMITS } from "@kibo/schema";

const DECLARATION =
  /^\s*export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\s*\*?|abstract\s+class|class|const\s+enum|const|let|var|enum|type|interface|namespace)\s+([A-Za-z_$][\w$]*)/;
const EXPORT_LIST = /^\s*export\s+(?:type\s+)?\{([^}]*)\}(\s*from\b)?/;
const COMMON_JS = /^\s*(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=(?!=)/;

const exportedName = (item: string): string | null => {
  const parts = item
    .trim()
    .replace(/^type\s+/, "")
    .split(/\s+as\s+/);
  const name = parts[parts.length - 1]?.trim() ?? "";
  return name === "" ? null : name;
};

const namesOf = (line: string): string[] => {
  const declared = DECLARATION.exec(line)?.[1];
  if (declared) return [declared];
  const list = EXPORT_LIST.exec(line);
  if (list) return list[2] ? [] : (list[1] ?? "").split(",").flatMap((item) => exportedName(item) ?? []);
  const commonJs = COMMON_JS.exec(line)?.[1];
  return commonJs ? [commonJs] : [];
};

export function isCandidateExport(name: string, generic: readonly string[]): boolean {
  return name.length >= DUPLICATION_LIMITS.exportNameMin && !generic.includes(name);
}

export function exportsOf(addedLines: readonly string[], generic: readonly string[]): string[] {
  const out = new Set<string>();
  for (const line of addedLines) {
    for (const name of namesOf(line)) if (isCandidateExport(name, generic)) out.add(name);
  }
  return [...out];
}
