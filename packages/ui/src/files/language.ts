import { fr } from "../i18n/fr";

export type Language = { id: string; label: string };

const TYPESCRIPT: Language = { id: "typescript", label: "TypeScript" };
const JAVASCRIPT: Language = { id: "javascript", label: "JavaScript" };
const YAML: Language = { id: "yaml", label: "YAML" };

const BY_EXTENSION: Record<string, Language> = {
  ts: TYPESCRIPT,
  mts: TYPESCRIPT,
  cts: TYPESCRIPT,
  tsx: { id: "tsx", label: "TSX" },
  js: JAVASCRIPT,
  mjs: JAVASCRIPT,
  cjs: JAVASCRIPT,
  jsx: { id: "jsx", label: "JSX" },
  json: { id: "json", label: "JSON" },
  md: { id: "markdown", label: "Markdown" },
  css: { id: "css", label: "CSS" },
  html: { id: "html", label: "HTML" },
  rs: { id: "rust", label: "Rust" },
  toml: { id: "toml", label: "TOML" },
  yml: YAML,
  yaml: YAML,
  sh: { id: "shellscript", label: "Shell" },
  py: { id: "python", label: "Python" },
  go: { id: "go", label: "Go" },
  sql: { id: "sql", label: "SQL" },
};

export function languageOf(path: string): Language {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  return BY_EXTENSION[ext] ?? { id: "text", label: fr.file.plainText };
}
