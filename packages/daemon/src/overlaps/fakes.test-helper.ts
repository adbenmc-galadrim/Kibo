import {
  DUPLICATION_BINARY_EXTENSIONS,
  DUPLICATION_CODE_EXTENSIONS,
  DUPLICATION_IGNORE_DIRS,
  DUPLICATION_IGNORE_GLOBS,
  DUPLICATION_SECRET_GLOBS,
} from "@kibo/schema";
import { sha256Hex } from "./hash";
import type { LineTools } from "./workspace-index";

const extension = (path: string): string => path.slice(path.lastIndexOf(".") + 1);
const baseName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

const globMatches = (glob: string, name: string): boolean =>
  new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(name);

const isSecretPath = (path: string): boolean =>
  DUPLICATION_SECRET_GLOBS.some((g) => globMatches(g, baseName(path)));

export const fakeLineTools: LineTools = {
  lineHashes: (lines, hash) =>
    lines
      .map(({ line, text }) => ({ line, text: text.trim() }))
      .filter(({ text }) => text !== "")
      .map(({ line, text }) => ({ line, hash: hash(text).slice(0, 16), chars: text.length })),
  exportsOf: (lines) =>
    lines.flatMap((text) => /^export (?:const|function) (\w+)/.exec(text)?.slice(1, 2) ?? []),
  importsOf: (lines) =>
    lines.flatMap(({ line, text }) => {
      const m = /^import \{ (\w+) \} from "(\.[^"]+)"/.exec(text);
      return m ? [{ spec: m[2] ?? "", names: [m[1] ?? ""], line }] : [];
    }),
  isIgnoredPath: (path, settings) =>
    DUPLICATION_IGNORE_DIRS.some((d) => `/${path}`.includes(`/${d}`)) ||
    DUPLICATION_IGNORE_GLOBS.some((g) => globMatches(g, baseName(path))) ||
    DUPLICATION_BINARY_EXTENSIONS.includes(extension(path)) ||
    settings.ignore.some((g) => globMatches(g, path)) ||
    isSecretPath(path),
  isSecretPath,
  isCodePath: (path) => DUPLICATION_CODE_EXTENSIONS.includes(extension(path)),
};

export const testHash = sha256Hex;
