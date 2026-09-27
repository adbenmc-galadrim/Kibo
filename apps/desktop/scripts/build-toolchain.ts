import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const root = resolve(import.meta.dir, "../../..");
const { values } = parseArgs({ options: { out: { type: "string" } } });
const out = resolve(values.out ?? join(root, "apps/desktop/src-tauri/toolchain"));
const ROOTS = [
  "typescript",
  "@kibo/sdk",
  "@kibo/schema",
  "@kibo/core",
  "@kibo/devkit",
  "react",
  "react-dom",
  "lucide-react",
  "@testing-library/react",
  "@testing-library/dom",
  "@happy-dom/global-registrator",
  "@types/bun",
  "@types/react",
  "tailwindcss",
  "@tailwindcss/node",
  "@tailwindcss/oxide",
  "tw-animate-css",
  "shadcn",
];
const LEAVES = ["shadcn"];
const MUSL_VARIANT = /-musl(eabihf)?$/;
const DEPENDENCY_FIELDS = ["dependencies", "optionalDependencies", "peerDependencies"];

function packageDir(name: string, from: string): string | null {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    if (dirname(dir) === dir) return null;
  }
}

function dependencyNames(manifest: unknown): string[] {
  if (typeof manifest !== "object" || manifest === null) return [];
  return DEPENDENCY_FIELDS.flatMap((field) => {
    const deps: unknown = Reflect.get(manifest, field);
    return typeof deps === "object" && deps !== null ? Object.keys(deps) : [];
  });
}

function closure(): Map<string, string> {
  const seen = new Map<string, string>();
  const queue: [string, string][] = ROOTS.map((name) => [name, root]);
  for (let next = queue.shift(); next; next = queue.shift()) {
    const [name, from] = next;
    if (MUSL_VARIANT.test(name)) continue;
    const dir = packageDir(name, from);
    if (!dir) continue;
    const known = seen.get(name);
    if (known === dir) continue;
    if (known) throw new Error(`toolchain package ${name} resolves to two versions: ${known} and ${dir}`);
    seen.set(name, dir);
    if (LEAVES.includes(name)) continue;
    const manifest: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    for (const dep of dependencyNames(manifest)) queue.push([dep, dir]);
  }
  const missing = ROOTS.filter((name) => !seen.has(name));
  if (missing.length > 0) throw new Error(`toolchain packages not installed: ${missing.join(", ")}`);
  return seen;
}

const packages = closure();
rmSync(out, { recursive: true, force: true });
for (const [name, dir] of packages) {
  const target = join(out, "node_modules", name);
  mkdirSync(dirname(target), { recursive: true });
  const nested = join(dir, "node_modules");
  cpSync(dir, target, {
    recursive: true,
    dereference: true,
    filter: (src) => src !== nested && !src.startsWith(`${nested}/`),
  });
}
console.log(`toolchain: ${packages.size} packages in ${out}`);
