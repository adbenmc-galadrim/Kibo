import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOW_PATH = join(import.meta.dir, "../../../.github/workflows/release.yml");
const workflowText = readFileSync(WORKFLOW_PATH, "utf8");
const IMPORT_STEP = "Importer le certificat de signature";
const SIGNED_ONLY = "runner.os == 'macOS' && env.MACOS_SIGNING_P12 != ''";

type Step = {
  name: string | undefined;
  uses: string | undefined;
  if: string | undefined;
  run: string | undefined;
  env: Record<string, string>;
};

function field(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || !(key in value)) throw new Error(`missing ${key}`);
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toStep(value: unknown): Step {
  if (typeof value !== "object" || value === null) throw new Error("step is not an object");
  const entries = Object.fromEntries(Object.entries(value));
  const env = typeof entries.env === "object" && entries.env !== null ? entries.env : {};
  return {
    name: text(entries.name),
    uses: text(entries.uses),
    if: text(entries.if),
    run: text(entries.run),
    env: Object.fromEntries(Object.entries(env).map(([key, item]) => [key, String(item)])),
  };
}

const buildJob = field(field(Bun.YAML.parse(workflowText), "jobs"), "build");
const steps = (() => {
  const raw = field(buildJob, "steps");
  if (!Array.isArray(raw)) throw new Error("steps is not a list");
  return raw.map(toStep);
})();
const importIndex = steps.findIndex((step) => step.name === IMPORT_STEP);
const tauriIndex = steps.findIndex((step) => step.uses?.startsWith("tauri-apps/tauri-action"));
const importStep = steps[importIndex];

test("the build job reads the two signing secrets into its environment", () => {
  expect(field(buildJob, "env")).toEqual({
    MACOS_SIGNING_P12: `\${{ secrets.MACOS_SIGNING_P12 }}`,
    MACOS_SIGNING_P12_PASSWORD: `\${{ secrets.MACOS_SIGNING_P12_PASSWORD }}`,
  });
});

test("the certificate is imported on macOS only when the secret exists, before tauri-action", () => {
  expect(importIndex).toBeGreaterThanOrEqual(0);
  expect(importIndex).toBeLessThan(tauriIndex);
  expect(importStep?.if).toBe(SIGNED_ONLY);
});

test("the import uses a throwaway keychain trusted for code signing", () => {
  const script = importStep?.run ?? "";
  expect(script).toContain("security create-keychain");
  expect(script).toContain("security import");
  expect(script).toContain("security set-key-partition-list");
  expect(script).toMatch(/security add-trusted-cert .*-p codeSign/);
});

test("the Tauri signing variables exist only after the import, with the stable identity", () => {
  const script = importStep?.run ?? "";
  expect(script).toContain('APPLE_CERTIFICATE=$MACOS_SIGNING_P12"');
  expect(script).toContain('APPLE_CERTIFICATE_PASSWORD=$MACOS_SIGNING_P12_PASSWORD"');
  expect(script).toContain('APPLE_SIGNING_IDENTITY=Kibo Code Signing"');
  expect(script).toContain('>> "$GITHUB_ENV"');
  expect(Object.keys(steps[tauriIndex]?.env ?? {}).filter((name) => name.startsWith("APPLE_"))).toEqual([]);
});

test("the throwaway keychain is deleted at the end of a signed build", () => {
  const cleanup = steps.find((step) => step.run?.includes("security delete-keychain"));
  expect(cleanup?.if).toBe(`always() && ${SIGNED_ONLY}`);
  expect(cleanup ? steps.indexOf(cleanup) : -1).toBeGreaterThan(tauriIndex);
});

test("no Apple account, team or notarization appears in the release", () => {
  expect(workflowText).not.toMatch(/APPLE_ID|APPLE_TEAM_ID|APPLE_PASSWORD|APPLE_API|notar/i);
});
