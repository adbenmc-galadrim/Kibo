import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  ComponentManifest,
  diffPermissions,
  grantedOf,
  isBuiltinId,
  KiboError,
  permissionList,
  type ValidationReport,
} from "@kibo/schema";
import type { BunCommand } from "./bun-command";
import { FR_DEVKIT, formatIssue } from "./fr";
import { listSourceFiles, readSources } from "./hash";
import { checkImports } from "./imports";
import { inferPermissions } from "./infer-permissions";
import type { OsSandbox } from "./os-sandbox";
import type { Toolchain } from "./toolchain";
import { typecheckComponent } from "./typecheck";
import { loadTypeScript } from "./typescript";
import { runComponentTests } from "./validate-tests";

export type ValidateOptions = {
  toolchain: Toolchain;
  bun?: BunCommand;
  sandbox?: OsSandbox;
  timeoutMs?: number;
  now?: () => number;
};
export type ValidationStamp = { hash: string; version: string; ok: boolean; at: number };

const STAMP = join(".kibo", "validation.json");

const step = (errors: string[]) => ({ ok: errors.length === 0, errors });
const isMissingFile = (e: unknown) => e instanceof Error && "code" in e && e.code === "ENOENT";

function emptyReport(): ValidationReport {
  return {
    manifest: step([]),
    imports: step([]),
    typecheck: step([]),
    tests: { ok: false, passed: 0, failed: 0, output: "" },
    conformance: { ok: false, errors: [] },
    permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
    hash: null,
    ok: false,
  };
}

function stampOf(raw: unknown): ValidationStamp | null {
  if (typeof raw !== "object" || raw === null) return null;
  const [hash, version, ok, at] = ["hash", "version", "ok", "at"].map((k) => Reflect.get(raw, k));
  if (typeof hash !== "string" || typeof version !== "string") return null;
  if (typeof ok !== "boolean" || typeof at !== "number") return null;
  return { hash, version, ok, at };
}

export async function readValidationStamp(dir: string): Promise<ValidationStamp | null> {
  try {
    return stampOf(JSON.parse(await readFile(join(dir, STAMP), "utf8")));
  } catch (e) {
    if (isMissingFile(e) || e instanceof SyntaxError) return null;
    throw e;
  }
}

async function readManifest(dir: string): Promise<ComponentManifest | string[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(dir, "kibo.component.json"), "utf8"));
  } catch (e) {
    if (isMissingFile(e) || e instanceof SyntaxError) return [FR_DEVKIT.manifestUnreadable];
    throw e;
  }
  const parsed = ComponentManifest.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`);
  if (isBuiltinId(parsed.data.id)) return [FR_DEVKIT.reservedId(parsed.data.id)];
  return parsed.data;
}

async function copySources(dir: string, copy: string, toolchain: Toolchain): Promise<string[]> {
  const files = await listSourceFiles(dir);
  for (const f of files) {
    await mkdir(dirname(join(copy, f)), { recursive: true });
    await cp(join(dir, f), join(copy, f));
  }
  await symlink(join(toolchain.root, "node_modules"), join(copy, "node_modules"), "dir");
  return files;
}

async function sourcesOf(dir: string, copy: string, toolchain: Toolchain) {
  try {
    const files = await copySources(dir, copy, toolchain);
    return { files, hash: (await readSources(copy)).hash };
  } catch (e) {
    if (e instanceof KiboError && e.code === "VALIDATION_FAILED") return FR_DEVKIT.sourcesRefused(e.detail);
    throw e;
  }
}

async function checkCopy(
  copy: string,
  files: string[],
  manifest: ComponentManifest,
  opts: ValidateOptions,
  report: ValidationReport,
): Promise<void> {
  const ts = await loadTypeScript(opts.toolchain);
  const checked = files.filter((f) => /\.(tsx?|css)$/.test(f));
  const texts = await Promise.all(
    checked.map(async (path) => ({ path, text: await readFile(join(copy, path), "utf8") })),
  );
  report.imports = step(checkImports(ts, texts).map(formatIssue));
  report.typecheck = step(typecheckComponent(ts, copy, files, opts.toolchain));
  const tests = await runComponentTests(copy, opts);
  report.tests = tests.report;

  const inference = await inferPermissions(copy, opts.toolchain);
  const declared = permissionList(grantedOf(manifest));
  const used = [...new Set([...inference.used, ...(tests.used ?? [])])].sort();
  const diff = diffPermissions(declared, used);
  const errors = inference.issues.map(formatIssue);
  report.permissions = { declared, used, missing: diff.missing, unused: diff.unused, errors };
  report.conformance = step([
    ...(tests.used === null ? [FR_DEVKIT.noConformance] : []),
    ...(tests.used ?? []).filter((p) => diff.missing.includes(p)).map(FR_DEVKIT.missing),
  ]);
  report.ok =
    report.imports.ok &&
    report.typecheck.ok &&
    report.tests.ok &&
    report.conformance.ok &&
    diff.missing.length === 0 &&
    errors.length === 0;
}

async function writeStamp(dir: string, stamp: ValidationStamp): Promise<void> {
  await mkdir(join(dir, ".kibo"), { recursive: true });
  await writeFile(join(dir, STAMP), JSON.stringify(stamp));
}

export async function validateComponent(dir: string, opts: ValidateOptions): Promise<ValidationReport> {
  const report = emptyReport();
  const base = await realpath(await mkdtemp(join(tmpdir(), "kibo-validate-")));
  try {
    const manifest = await readManifest(dir);
    if (Array.isArray(manifest)) {
      report.manifest = step(manifest);
      return report;
    }
    const copy = join(base, manifest.id);
    const sources = await sourcesOf(dir, copy, opts.toolchain);
    if (typeof sources === "string") {
      report.manifest = step([sources]);
      return report;
    }
    report.hash = sources.hash;
    await checkCopy(copy, sources.files, manifest, opts, report);
    const at = (opts.now ?? Date.now)();
    await writeStamp(dir, { hash: sources.hash, version: manifest.version, ok: report.ok, at });
    return report;
  } catch (e) {
    if (e instanceof KiboError) throw e;
    throw new KiboError(
      "INTERNAL",
      `validation of ${dir} crashed: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}
