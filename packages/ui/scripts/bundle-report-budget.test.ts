import { describe, expect, test } from "bun:test";
import {
  type BuiltChunk,
  ENTRY_GZIP_BUDGET,
  FORBIDDEN_IN_ENTRY,
  formatGzip,
  PHASE_BUDGET,
  reportEntry,
} from "./bundle-report";

const entry = (code: string): BuiltChunk[] => [
  { fileName: "index.js", isEntry: true, imports: [], code, moduleIds: [] },
];
const rawSize = (bytes: Uint8Array) => bytes.length;

describe("phase budget", () => {
  test("the phase requirement follows the measure and the ceiling stays 6 000 above it", () => {
    expect(ENTRY_GZIP_BUDGET).toBe(204_000);
    expect(PHASE_BUDGET).toBe(198_000);
  });

  test("exceeding the phase requirement fails even under the global ceiling", () => {
    const opts = { budget: 10, phaseBudget: 6, forbidden: [], gzip: rawSize };
    expect(reportEntry(entry("123456"), opts)).toMatchObject({ gzipBytes: 6, phaseBudget: 6, ok: true });
    expect(reportEntry(entry("1234567"), opts).ok).toBe(false);
  });

  test("the global ceiling still fails on its own", () => {
    expect(
      reportEntry(entry("12345"), { budget: 4, phaseBudget: 100, forbidden: [], gzip: rawSize }).ok,
    ).toBe(false);
  });

  test("the size is shown with its exact byte count", () => {
    expect(formatGzip(223_812)).toBe("223.8 kB (223812 octets)");
  });

  test("phase 26, the AI and onboarding texts stay out of the entry, not the main texts", () => {
    const i18n = (p: string) => FORBIDDEN_IN_ENTRY.some((r) => r.test(`/x/packages/ui/src/i18n/${p}`));
    expect(i18n("fr-ai.ts")).toBe(true);
    expect(i18n("fr.ts")).toBe(false);
  });

  test("phase 29, the git client texts stay out of the entry", () => {
    const forbidden = (p: string) => FORBIDDEN_IN_ENTRY.some((r) => r.test(`/x/packages/ui/src/${p}`));
    expect(forbidden("i18n/fr-changes.ts")).toBe(true);
    expect(forbidden("i18n/fr-code.ts")).toBe(false);
  });
});
