import { existsSync, lstatSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ASK_TOOL } from "@kibo/schema";
import { MAX_INPUT_KEYS } from "../agents/hook-payload";
import type { Guard, GuardDecision } from "./ports";

export type DraftGuardOptions = { draftDir: string; readRoots: string[]; allowServer: boolean };

export const TEST_COMMAND = /^kibo component test(?: \.)?\n?$/;
const TEST_FILE = /^[A-Za-z0-9_-]+\.test\.tsx$/;
const MAX_PATH_LENGTH = 1024;
const BASH_KEYS = new Set(["command", "description", "timeout"]);
const GLOB_CHARS = /[*?[\]]/;
const WRITE_TOOLS = new Map([
  ["Edit", "file_path"],
  ["MultiEdit", "file_path"],
  ["Write", "file_path"],
]);
const SEARCH_TOOLS = new Map([
  ["Glob", "path"],
  ["Grep", "path"],
]);

const allow: GuardDecision = { decision: "allow" };
const deny = (reason: string): GuardDecision => ({ decision: "deny", reason });
const real = (p: string): string | null => (existsSync(p) ? realpathSync(p) : null);
const within = (root: string, target: string) => {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const textArg = (input: Record<string, unknown>, key: string): string | null | undefined => {
  if (!Object.hasOwn(input, key)) return undefined;
  const v = input[key];
  const valid = typeof v === "string" && v.length > 0 && v.length < MAX_PATH_LENGTH && !v.includes("\0");
  return valid ? v : null;
};
const pathArg = (input: Record<string, unknown>, key: string): string | null | undefined => {
  const v = textArg(input, key);
  return v?.split(sep).includes("..") ? null : v;
};
const confinedPattern = (pattern: string) =>
  !isAbsolute(pattern) && !pattern.startsWith("~") && !/\.\.|[{}]/.test(pattern);

const crossesSymlink = (base: string, pattern: string): boolean => {
  let current = base;
  for (const segment of pattern.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (GLOB_CHARS.test(segment)) return false;
    current = join(current, segment);
    const stat = lstatSync(current, { throwIfNoEntry: false });
    if (stat === undefined) return false;
    if (stat.isSymbolicLink()) return true;
  }
  return false;
};

export const denyAllGuard: Guard = ({ toolName }) => deny(`${toolName} is not available to this profile`);

export function createDraftGuard(opts: DraftGuardOptions): Guard {
  const root = realpathSync(opts.draftDir);
  const readRoots = [root, ...opts.readRoots.map((r) => realpathSync(r))];
  const writable = (name: string) =>
    name === "ui.tsx" || (opts.allowServer && name === "server.ts") || TEST_FILE.test(name);

  const checkWrite = (raw: string): GuardDecision => {
    const abs = resolve(root, raw);
    if (real(dirname(abs)) !== root) return deny(`writes are limited to the draft folder: ${raw}`);
    const name = basename(abs);
    if (!writable(name)) return deny(`${name} is reserved to Kibo`);
    const stat = lstatSync(resolve(root, name), { throwIfNoEntry: false });
    if (stat === undefined) return allow;
    if (!stat.isFile()) return deny(`${name} is not a regular file`);
    if (stat.nlink > 1) return deny(`${name} is a hard link`);
    return allow;
  };

  const checkRead = (raw: string): GuardDecision => {
    const abs = resolve(root, raw);
    const resolved = real(abs) ?? real(dirname(abs));
    if (resolved !== null && readRoots.some((r) => within(r, resolved))) return allow;
    return deny(`reads are limited to the draft folder and the SDK: ${raw}`);
  };

  const checkSearch = (
    input: Record<string, unknown>,
    pathKey: string,
    patternKey: string,
  ): GuardDecision => {
    const pattern = textArg(input, patternKey);
    if (pattern === null || (pattern !== undefined && !confinedPattern(pattern)))
      return deny(`invalid ${patternKey}: searches stay in their folder`);
    const p = pathArg(input, pathKey);
    if (p === null) return deny(`invalid ${pathKey}`);
    const base = p === undefined ? allow : checkRead(p);
    if (base.decision === "deny") return base;
    if (pattern !== undefined && crossesSymlink(resolve(root, p ?? "."), pattern))
      return deny(`${patternKey} goes through a symbolic link`);
    return allow;
  };

  const check = (toolName: string, toolInput: Record<string, unknown>): GuardDecision => {
    if (toolName === ASK_TOOL) return allow;
    const writeKey = WRITE_TOOLS.get(toolName);
    if (writeKey) {
      const p = pathArg(toolInput, writeKey);
      return p ? checkWrite(p) : deny(`invalid ${writeKey}`);
    }
    if (toolName === "Read") {
      const p = pathArg(toolInput, "file_path");
      return p ? checkRead(p) : deny("invalid file_path");
    }
    const searchKey = SEARCH_TOOLS.get(toolName);
    if (searchKey) return checkSearch(toolInput, searchKey, toolName === "Glob" ? "pattern" : "glob");
    if (toolName === "Bash") {
      if (Object.keys(toolInput).some((key) => !BASH_KEYS.has(key)))
        return deny("Bash options are not allowed");
      const command = textArg(toolInput, "command");
      return command && TEST_COMMAND.test(command) ? allow : deny("only `kibo component test .` may run");
    }
    return deny(`${toolName} is not available to the component generator`);
  };

  return ({ toolName, toolInput }) => {
    if (!isRecord(toolInput)) return deny(`${toolName} input is not an object`);
    if (Object.keys(toolInput).length >= MAX_INPUT_KEYS) return deny(`${toolName} input has too many fields`);
    return check(toolName, toolInput);
  };
}
