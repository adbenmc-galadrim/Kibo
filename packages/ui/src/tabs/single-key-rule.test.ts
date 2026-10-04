import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = resolve(import.meta.dir, "../../../..");
const ALLOWED = new Set([
  "packages/sdk/src/key-guard.ts",
  "packages/sdk/src/key-guard.test.ts",
  "packages/sdk/src/sandbox.test.tsx",
  "packages/ui/src/tabs/single-key-rule.test.ts",
  "packages/ui/src/shell/PairingScreen.tsx",
  "packages/ui/src/shell/pairing-screen.test.tsx",
]);

test("no interface code compares a key to Backspace or Delete outside the guard and the pairing field", () => {
  const offenders: string[] = [];
  for (const pattern of [
    "packages/ui/src/**/*.{ts,tsx}",
    "components/*/src/**/*.{ts,tsx}",
    "packages/sdk/src/**/*.{ts,tsx}",
  ]) {
    for (const file of new Bun.Glob(pattern).scanSync({ cwd: repo })) {
      if (ALLOWED.has(file)) continue;
      if (/["'](Backspace|Delete)["']/.test(readFileSync(resolve(repo, file), "utf8"))) offenders.push(file);
    }
  }
  expect(offenders).toEqual([]);
});
