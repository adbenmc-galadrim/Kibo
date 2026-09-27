import { afterAll, expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { osSandbox } from "./os-sandbox";
import { copyFixture, DEV_TOOLCHAIN } from "./test-kit";
import { validateComponent } from "./validate";

const disposers: (() => void)[] = [];
afterAll(() => {
  for (const d of disposers) d();
});
const fixture = (name: string) => {
  const f = copyFixture(name);
  disposers.push(f.dispose);
  return f.dir;
};
const sandboxAvailable = await osSandbox()
  .ready()
  .then(
    () => true,
    (e: unknown) => {
      if (e instanceof KiboError && e.code === "SANDBOX_UNAVAILABLE") return false;
      throw e;
    },
  );
const opts = { toolchain: DEV_TOOLCHAIN, now: () => 1_000 };
const VALIDATION_TIMEOUT_MS = 120_000;
const FAILING_TEST =
  'import { expect, test } from "bun:test";\ntest("publisher test", () => expect(1).toBe(2));\n';

test.if(sandboxAvailable)(
  "conformanceOnly ignores the publisher tests and runs the generic suite",
  async () => {
    const dir = fixture("hello");
    writeFileSync(join(dir, "component.test.tsx"), FAILING_TEST);
    const report = await validateComponent(dir, { ...opts, conformanceOnly: true });
    expect(report.tests.ok).toBe(true);
    expect(report.conformance.ok).toBe(true);
    expect(report.ok).toBe(true);
  },
  VALIDATION_TIMEOUT_MS,
);

test.if(sandboxAvailable)(
  "conformanceOnly works without any test file in the package",
  async () => {
    const dir = fixture("hello");
    rmSync(join(dir, "component.test.tsx"));
    const report = await validateComponent(dir, { ...opts, conformanceOnly: true });
    expect(report.ok).toBe(true);
  },
  VALIDATION_TIMEOUT_MS,
);

test.if(sandboxAvailable)(
  "without conformanceOnly the publisher tests still run",
  async () => {
    const dir = fixture("hello");
    writeFileSync(join(dir, "component.test.tsx"), FAILING_TEST);
    const report = await validateComponent(dir, opts);
    expect(report.ok).toBe(false);
  },
  VALIDATION_TIMEOUT_MS,
);

const PUBLISHER_SPEC =
  'declare const test: (n: string, f: () => void) => void;\ntest("publisher spec", () => {\n  throw new Error("publisher spec ran");\n});\nexport {};\n';

test.if(sandboxAvailable)(
  "conformanceOnly runs no publisher spec shipped as a source",
  async () => {
    const dir = fixture("hello");
    writeFileSync(join(dir, "lib.spec.ts"), PUBLISHER_SPEC);
    writeFileSync(join(dir, "aa_test.ts"), PUBLISHER_SPEC);
    const report = await validateComponent(dir, { ...opts, conformanceOnly: true });
    expect(report.tests.output).not.toContain("publisher spec ran");
    expect(report.tests.ok).toBe(true);
    expect(report.ok).toBe(true);
  },
  VALIDATION_TIMEOUT_MS,
);
