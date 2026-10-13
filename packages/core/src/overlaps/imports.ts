import type { CodeImport } from "@kibo/schema";

const SPEC = String.raw`["']([^"'\n]+)["']`;
const STATIC_IMPORT = new RegExp(String.raw`\bimport\s+(?:type\s+)?([^"';]*?)\s*\bfrom\s*${SPEC}`, "g");
const SIDE_EFFECT_IMPORT = new RegExp(String.raw`^\s*import\s*${SPEC}`, "g");
const CALL_IMPORT = new RegExp(String.raw`\b(?:import|require)\s*\(\s*${SPEC}\s*\)`, "g");
const RE_EXPORT = new RegExp(
  String.raw`\bexport\s+(?:type\s+)?(\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?)\s*from\s*${SPEC}`,
  "g",
);

const RESOLVE_EXTENSIONS = ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"];

export const isRelativeSpec = (spec: string): boolean =>
  spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../");

const importedNames = (clause: string): string[] => {
  const braces = /\{([^}]*)\}/.exec(clause)?.[1];
  if (braces === undefined) return [];
  return braces.split(",").flatMap((item) => {
    const name = item
      .trim()
      .replace(/^type\s+/, "")
      .split(/\s+as\s+/)[0]
      ?.trim();
    return name ? [name] : [];
  });
};

type Found = { at: number; spec: string; names: string[] };

const collect = (text: string, pattern: RegExp, names: (match: RegExpExecArray) => string[]): Found[] =>
  [...text.matchAll(pattern)].map((match) => ({
    at: match.index,
    spec: match[match.length - 1] ?? "",
    names: names(match),
  }));

const importsOfLine = (text: string): Found[] =>
  [
    ...collect(text, STATIC_IMPORT, (m) => importedNames(m[1] ?? "")),
    ...collect(text, SIDE_EFFECT_IMPORT, () => []),
    ...collect(text, CALL_IMPORT, () => []),
    ...collect(text, RE_EXPORT, (m) => importedNames(m[1] ?? "")),
  ].sort((x, y) => x.at - y.at);

export function importsOf(addedLines: readonly { line: number; text: string }[]): CodeImport[] {
  return addedLines.flatMap(({ line, text }) =>
    importsOfLine(text)
      .filter((found) => isRelativeSpec(found.spec))
      .map((found) => ({ spec: found.spec, names: found.names, line })),
  );
}

const joinPath = (fromPath: string, spec: string): string | null => {
  const segments = fromPath.split("/").slice(0, -1);
  for (const part of spec.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (segments.length === 0) return null;
      segments.pop();
    } else segments.push(part);
  }
  return segments.join("/");
};

const candidatesOf = (base: string, folderOnly: boolean): string[] => {
  const index = RESOLVE_EXTENSIONS.map((ext) => (base === "" ? `index.${ext}` : `${base}/index.${ext}`));
  if (folderOnly) return index;
  return [base, ...RESOLVE_EXTENSIONS.map((ext) => `${base}.${ext}`), ...index];
};

export function resolveRelative(
  fromPath: string,
  spec: string,
  exists: (p: string) => boolean,
): string | null {
  if (!isRelativeSpec(spec)) return null;
  const base = joinPath(fromPath, spec);
  if (base === null) return null;
  const folderOnly = base === "" || spec.endsWith("/") || spec === "." || spec === "..";
  return candidatesOf(base, folderOnly).find(exists) ?? null;
}
