import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, sep } from "node:path";
import {
  KiboError,
  renderTemplate,
  type SetupStep,
  singleQuotedVariable,
  type WorktreeRecipe,
  type WorktreeVars,
} from "@kibo/schema";
import { cleanEnv } from "../runs/child-env";
import type { GitRunner } from "../runs/workspace-prep";
import type { ShellRunner } from "./worktree-prep";

export type RecipeVars = Required<Pick<WorktreeVars, "branch" | "slug" | "key" | "path">> & {
  short: string;
  short_: string;
  repo: string;
};
export type RecipeInput = {
  recipe: WorktreeRecipe;
  root: string;
  dir: string;
  vars: RecipeVars;
  siblings: string[];
  shell: ShellRunner;
  probe(port: number): Promise<boolean>;
  onSetup?(step: SetupStep): void;
  log(line: string): void;
};
export type RecipeResult = { copied: string[]; missing: string[]; ports: Record<string, number> };
type RecipeEnv = NonNullable<WorktreeRecipe["env"]>;
type Ports = Record<string, number>;

export const RECIPE_TIMEOUT_MS = 600_000;
const TAIL_LINES = 20;
const MAX_PORT = 65_535;
const SAMPLE_VARS: RecipeVars = {
  branch: "feat/x",
  slug: "feat-x",
  key: "key-1",
  path: "/repo-x",
  short: "x",
  short_: "x",
  repo: "/repo",
};

const failed = (detail: string) => new KiboError("WORKSPACE_FAILED", detail);
const tail = (output: string) => output.trim().split("\n").slice(-TAIL_LINES).join("\n");
const envRef = (name: string) => "$".concat("{", name, "}");
const KIBO_NAMES: readonly (readonly [keyof RecipeVars, string])[] = [
  ["branch", "KIBO_BRANCH"],
  ["slug", "KIBO_SLUG"],
  ["key", "KIBO_KEY"],
  ["path", "KIBO_PATH"],
  ["short", "KIBO_SHORT"],
  ["short_", "KIBO_SHORT_"],
  ["repo", "KIBO_REPO"],
];

function render(template: string, vars: WorktreeVars): string {
  try {
    return renderTemplate(template, vars);
  } catch (e) {
    throw failed(e instanceof KiboError ? e.detail : String(e));
  }
}

const portSample = (recipe: WorktreeRecipe): Ports => ({ ...recipe.env?.ports?.keys });

export function assertRecipe(recipe: WorktreeRecipe): void {
  const vars = { ...SAMPLE_VARS, ...portSample(recipe) };
  const env = recipe.env;
  for (const from of recipe.copyFrom) renderTemplate(from, { ...vars, sibling: "/sibling" });
  const templates = [
    ...recipe.after,
    ...Object.values(env?.set ?? {}),
    ...Object.values(env?.replace ?? {}).map(([, replacement]) => replacement),
  ];
  for (const template of templates) renderTemplate(template, vars);
  for (const command of recipe.after) {
    const quoted = singleQuotedVariable(command);
    if (quoted !== null)
      throw new KiboError(
        "INVALID_INPUT",
        `after variable {${quoted}} is inside single quotes and would not expand`,
      );
  }
}

export async function worktreeSiblings(root: string, dir: string, git: GitRunner): Promise<string[]> {
  const res = await git(["worktree", "list", "--porcelain"], root);
  if (res.code !== 0) throw new KiboError("GIT_FAILED", `git worktree list failed: ${res.stderr.trim()}`);
  const own = realpathSync(dir);
  return res.stdout
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length))
    .filter((path) => existsSync(path) && realpathSync(path) !== own)
    .map((path) => realpathSync(path));
}

const mtime = (path: string): number => statSync(path).mtimeMs;

type Source = { from: string; path: string };

function refused(input: RecipeInput, file: string, source: Source): false {
  input.log(`source refusée : ${file} (${source.path})`);
  return false;
}

const literally = (value: string) => () => value;

function confinedSource(source: Source): boolean {
  if (lstatSync(source.path).isSymbolicLink()) return false;
  return realpathSync(source.path).startsWith(realpathSync(source.from) + sep);
}

function sourceOf(input: RecipeInput, file: string): Source | null {
  for (const template of input.recipe.copyFrom) {
    const roots = template.startsWith("{sibling}")
      ? input.siblings.map((sibling) => render(template, { ...input.vars, sibling }))
      : [render(template, input.vars)];
    const found = roots
      .map((from) => ({ from, path: join(from, file) }))
      .filter((source) => isAbsolute(source.from) && existsSync(source.path))
      .filter((source) => confinedSource(source) || refused(input, file, source))
      .sort((a, b) => mtime(b.path) - mtime(a.path));
    if (found[0] !== undefined) return found[0];
  }
  return null;
}

function realLocation(path: string): string {
  const parent = dirname(path);
  if (existsSync(parent)) return join(realpathSync(parent), path.slice(parent.length + 1));
  return join(realLocation(parent), path.slice(parent.length + 1));
}

function confined(dir: string, file: string): string {
  const target = join(dir, file);
  const real = realLocation(target);
  if (!real.startsWith(realpathSync(dir) + sep))
    throw failed(`copy target ${file} resolves outside the worktree`);
  if (lstatSync(real, { throwIfNoEntry: false })?.isSymbolicLink())
    throw failed(`copy target ${file} is a symbolic link`);
  return real;
}

function copyFiles(input: RecipeInput): Pick<RecipeResult, "copied" | "missing"> {
  const copied: string[] = [];
  const missing: string[] = [];
  for (const file of input.recipe.copy) {
    const target = confined(input.dir, file);
    const source = sourceOf(input, file);
    if (source === null) {
      missing.push(file);
      input.log(`fichier manquant : ${file}`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source.path, target);
    copied.push(file);
    input.log(`copy ${file} from ${source.from}`);
  }
  return { copied, missing };
}

const linePattern = (key: string) => new RegExp(`^(export\\s+)?${key}\\s*=(.*)$`, "m");

function envValue(content: string, key: string): string | null {
  const match = linePattern(key).exec(content);
  return match === null ? null : (match[2] ?? "").trim().replace(/^["']|["']$/g, "");
}

function withValue(content: string, key: string, value: string): string {
  const pattern = linePattern(key);
  if (pattern.test(content))
    return content.replace(pattern, (_, prefix: string | undefined) => `${prefix ?? ""}${key}=${value}`);
  return `${content}${content.length > 0 && !content.endsWith("\n") ? "\n" : ""}${key}=${value}\n`;
}

function takenPorts(input: RecipeInput, env: RecipeEnv): Set<number> {
  const keys = Object.keys(env.ports?.keys ?? {});
  const taken = new Set<number>();
  for (const sibling of input.siblings) {
    const file = join(sibling, env.file);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const key of keys) {
      const port = Number.parseInt(envValue(content, key) ?? "", 10);
      if (Number.isInteger(port)) taken.add(port);
    }
  }
  return taken;
}

async function freePorts(input: RecipeInput, env: RecipeEnv): Promise<Ports> {
  const ports = env.ports;
  if (ports === null) return {};
  const taken = takenPorts(input, env);
  for (let i = 0; i < ports.count; i++) {
    const offset = (ports.from + i) * ports.step;
    const set = Object.entries(ports.keys).map(([key, base]) => [key, base + offset] as const);
    if (set.some(([, port]) => port > MAX_PORT)) break;
    if (set.some(([, port]) => taken.has(port))) continue;
    const free = await Promise.all(set.map(([, port]) => input.probe(port)));
    if (free.every(Boolean)) return Object.fromEntries(set);
  }
  throw failed(`no free port set among ${ports.count} candidates`);
}

async function writeEnv(input: RecipeInput, env: RecipeEnv): Promise<Ports> {
  const file = join(input.dir, env.file);
  if (!existsSync(file)) throw failed(`${env.file} is missing after the copies, ports cannot be assigned`);
  const target = confined(input.dir, env.file);
  const ports = await freePorts(input, env);
  let content = readFileSync(target, "utf8");
  for (const [key, port] of Object.entries(ports)) content = withValue(content, key, String(port));
  if (Object.keys(ports).length > 0)
    input.log(
      `ports ${Object.entries(ports)
        .map(([key, port]) => `${key}=${port}`)
        .join(" ")}`,
    );
  const vars = { ...input.vars, ...ports };
  for (const [key, [pattern, replacement]] of Object.entries(env.replace)) {
    const current = envValue(content, key);
    if (current === null) continue;
    content = withValue(
      content,
      key,
      current.replace(new RegExp(pattern), literally(render(replacement, vars))),
    );
    input.log(`replace ${key}`);
  }
  for (const [key, value] of Object.entries(env.set)) {
    content = withValue(content, key, render(value, vars));
    input.log(`set ${key}`);
  }
  writeFileSync(target, content);
  return ports;
}

function afterEnv(vars: RecipeVars, ports: Ports): Record<string, string> {
  const kibo = Object.fromEntries(KIBO_NAMES.map(([name, env]) => [env, vars[name]]));
  const portEnv = Object.fromEntries(Object.entries(ports).map(([key, port]) => [key, String(port)]));
  return { ...cleanEnv(process.env), ...portEnv, ...kibo, KIBO_WORKTREE: vars.path };
}

const envRefs = (ports: Ports): WorktreeVars => ({
  ...Object.fromEntries(Object.keys(ports).map((key) => [key, envRef(key)])),
  ...Object.fromEntries(KIBO_NAMES.map(([name, env]) => [name, envRef(env)])),
  branch: envRef("KIBO_BRANCH"),
  slug: envRef("KIBO_SLUG"),
  key: envRef("KIBO_KEY"),
});

async function runAfter(input: RecipeInput, ports: Ports): Promise<void> {
  const env = afterEnv(input.vars, ports);
  const refs = envRefs(ports);
  const report = input.onSetup ?? (() => {});
  const deadline = Date.now() + RECIPE_TIMEOUT_MS;
  for (const after of input.recipe.after) {
    const command = render(after, refs);
    const shown = render(after, { ...input.vars, ...ports });
    const started = Date.now();
    report({ command: shown, status: "running" });
    input.log(`$ ${command}`);
    const result = await input.shell(command, input.dir, env, Math.max(deadline - started, 1));
    const status = result.timedOut || result.code !== 0 ? "failed" : "done";
    report({ command: shown, status, durationMs: Date.now() - started });
    input.log(result.output);
    if (result.timedOut)
      throw new KiboError("TIMEOUT", `after commands exceeded ${RECIPE_TIMEOUT_MS / 1000}s`);
    if (result.code !== 0) throw failed(`after command exited with ${result.code}:\n${tail(result.output)}`);
  }
}

export async function applyRecipe(input: RecipeInput): Promise<RecipeResult> {
  const files = copyFiles(input);
  const ports = input.recipe.env === null ? {} : await writeEnv(input, input.recipe.env);
  await runAfter(input, ports);
  return { ...files, ports };
}
