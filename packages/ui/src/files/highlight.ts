import { createHighlighterCore, type HighlighterCore, type LanguageInput } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export { languageOf } from "./language";

export type Token = { content: string; light: string | undefined; dark: string | undefined };

export const MAX_HIGHLIGHT_LINES = 5000;

const LOADERS: Record<string, LanguageInput> = {
  typescript: () => import("@shikijs/langs/typescript"),
  tsx: () => import("@shikijs/langs/tsx"),
  javascript: () => import("@shikijs/langs/javascript"),
  jsx: () => import("@shikijs/langs/jsx"),
  json: () => import("@shikijs/langs/json"),
  markdown: () => import("@shikijs/langs/markdown"),
  css: () => import("@shikijs/langs/css"),
  html: () => import("@shikijs/langs/html"),
  rust: () => import("@shikijs/langs/rust"),
  toml: () => import("@shikijs/langs/toml"),
  yaml: () => import("@shikijs/langs/yaml"),
  shellscript: () => import("@shikijs/langs/shellscript"),
  python: () => import("@shikijs/langs/python"),
  go: () => import("@shikijs/langs/go"),
  sql: () => import("@shikijs/langs/sql"),
};

let highlighter: Promise<HighlighterCore> | null = null;

const getHighlighter = () => {
  highlighter ??= createHighlighterCore({
    themes: [import("@shikijs/themes/github-light"), import("@shikijs/themes/github-dark")],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
};

export const plainTokens = (code: string): Token[][] =>
  code.split("\n").map((content) => [{ content, light: undefined, dark: undefined }]);

export async function highlightLines(code: string, lang: string): Promise<Token[][]> {
  const loader = LOADERS[lang];
  if (!loader || code.split("\n").length > MAX_HIGHLIGHT_LINES) return plainTokens(code);
  const h = await getHighlighter();
  if (!h.getLoadedLanguages().includes(lang)) await h.loadLanguage(loader);
  return h
    .codeToTokensWithThemes(code, { lang, themes: { light: "github-light", dark: "github-dark" } })
    .map((line) =>
      line.map((t) => ({ content: t.content, light: t.variants.light?.color, dark: t.variants.dark?.color })),
    );
}
