import { isAbsolute, join, resolve } from "node:path";
import { validateComponent } from "@kibo/devkit";
import type { ValidationReport } from "@kibo/schema";
import { fr } from "../fr";
import type { CliIo } from "../index";

const isPath = (target: string): boolean => target.includes("/") || target === "." || target === "..";

export const componentDir = (target: string, io: CliIo): string =>
  isPath(target)
    ? isAbsolute(target)
      ? target
      : resolve(target)
    : join(io.home, "components", "src", target);

function printStep(io: CliIo, name: string, step: { ok: boolean; errors: string[] }): void {
  io.out(fr.step(name, step.ok));
  for (const e of step.errors) io.out(`  ${e}`);
}

function printReport(r: ValidationReport, io: CliIo): void {
  const s = fr.steps;
  printStep(io, s.manifest, r.manifest);
  printStep(io, s.imports, r.imports);
  printStep(io, s.typecheck, r.typecheck);
  io.out(fr.step(s.tests, r.tests.ok));
  io.out(fr.tests(r.tests.passed, r.tests.failed));
  if (!r.tests.ok && r.tests.output) io.out(r.tests.output);
  printStep(io, s.conformance, r.conformance);
  io.out(fr.step(s.permissions, r.permissions.missing.length === 0 && r.permissions.errors.length === 0));
  for (const p of r.permissions.missing) io.out(fr.missing(p));
  for (const e of r.permissions.errors) io.out(`  ${e}`);
  for (const p of r.permissions.unused) io.out(fr.unused(p));
}

export async function testCommand(target: string, io: CliIo): Promise<number> {
  const r = await validateComponent(componentDir(target, io), { toolchain: io.toolchain });
  printReport(r, io);
  io.out(r.ok ? fr.valid : fr.invalid);
  return r.ok ? 0 : 1;
}
