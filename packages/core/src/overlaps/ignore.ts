import {
  DUPLICATION_BINARY_EXTENSIONS,
  DUPLICATION_CODE_EXTENSIONS,
  DUPLICATION_IGNORE_DIRS,
  DUPLICATION_IGNORE_GLOBS,
  DUPLICATION_SECRET_GLOBS,
  DUPLICATION_TEST_GLOBS,
  type DuplicationSettings,
} from "@kibo/schema";

const escapeRegExp = (text: string): string => text.replace(/[.+^${}()|[\]\\]/g, "\\$&");

const translate = (glob: string): string => {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i] ?? "";
    if (char === "*" && glob[i + 1] === "*") {
      const slash = glob[i + 2] === "/";
      out += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (char === "*") out += "[^/]*";
    else if (char === "?") out += "[^/]";
    else out += escapeRegExp(char);
  }
  return out;
};

export function globToRegExp(glob: string): RegExp {
  const folder = glob.endsWith("/");
  const trimmed = glob.replace(/^\//, "").replace(/\/$/, "");
  const anchored = glob.startsWith("/") || trimmed.includes("/");
  const start = anchored ? "^" : "(?:^|/)";
  const end = folder ? "/" : "$";
  return new RegExp(`${start}${translate(trimmed)}${end}`);
}

const COMPILED_MAX = 1_000;
const compiled = new Map<string, RegExp>();

const regExpOf = (glob: string): RegExp => {
  const known = compiled.get(glob);
  if (known) return known;
  const re = globToRegExp(glob);
  if (compiled.size >= COMPILED_MAX) compiled.clear();
  compiled.set(glob, re);
  return re;
};

const matchesAny = (path: string, globs: readonly string[]): boolean =>
  globs.some((glob) => regExpOf(glob).test(path));

const extensionOf = (path: string): string => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
};

export const isSecretPath = (path: string): boolean => matchesAny(path, DUPLICATION_SECRET_GLOBS);

export const isTestPath = (path: string): boolean => matchesAny(path, DUPLICATION_TEST_GLOBS);

export const isCodePath = (path: string): boolean => DUPLICATION_CODE_EXTENSIONS.includes(extensionOf(path));

export const isBinaryPath = (path: string): boolean =>
  DUPLICATION_BINARY_EXTENSIONS.includes(extensionOf(path));

export function isIgnoredPath(path: string, settings: Pick<DuplicationSettings, "ignore">): boolean {
  return (
    matchesAny(path, DUPLICATION_IGNORE_DIRS) ||
    matchesAny(path, DUPLICATION_IGNORE_GLOBS) ||
    isSecretPath(path) ||
    isBinaryPath(path) ||
    matchesAny(path, settings.ignore)
  );
}
