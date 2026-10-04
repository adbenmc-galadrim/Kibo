import { describe, expect, test } from "bun:test";
import {
  ComponentManifest,
  diffPermissions,
  formatsOf,
  grantedOf,
  type PresencePeer,
  type ProjectCommand,
  type ProjectSnapshot,
  permissionList,
  secretHostsCovered,
  surfaceFor,
  type Theme,
  type TicketRun,
  USED_MARKER,
} from "@kibo/schema";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { LAZY_FALLBACK_SELECTOR } from "./lazy";
import { createMockSdk, type MockSdkOptions } from "./mock";
import { SdkProvider } from "./react";

export type ConformanceModule = { manifest: unknown; Component: ComponentType };
export type ConformanceSeed = (run: (cmd: ProjectCommand) => unknown) => void;
export type ConformanceOptions = Pick<
  MockSdkOptions,
  "fetch" | "server" | "notes" | "config" | "noteAges" | "mcp" | "ciRuns"
> & {
  runs?: (snapshot: ProjectSnapshot) => TicketRun[];
};

const THEMES: Theme[] = ["dark", "light"];
const COLLEAGUE: PresencePeer = {
  deviceId: "conformance-device",
  self: false,
  userId: "u-lea",
  name: "Léa",
  pageId: null,
  ticketId: null,
  runs: [{ ticketKey: "KIB-1", profile: "opus-dev-1", state: "running" }],
};
const LAZY_LOAD_TIMEOUT_MS = 25_000;
const RENDER_TEST_TIMEOUT_MS = 45_000;
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

async function withTheme(theme: Theme, work: () => Promise<void>): Promise<void> {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    await work();
  } finally {
    document.documentElement.classList.remove("dark");
  }
}

async function renderWithinPermissions(
  Component: ComponentType,
  manifest: ComponentManifest,
  declared: string[],
  opts: MockSdkOptions,
  runs: ConformanceOptions["runs"],
  config: Record<string, unknown> | null,
): Promise<void> {
  const m = createMockSdk(manifest, opts);
  if (opts.seed && runs) m.setRuns(runs(m.snapshot()));
  const { container } = render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const loaded = { timeout: LAZY_LOAD_TIMEOUT_MS };
  try {
    await waitFor(() => expect(container.childElementCount).toBeGreaterThan(0), loaded);
    await waitFor(() => expect(container.querySelector(LAZY_FALLBACK_SELECTOR)).toBeNull(), loaded);
    await settle();
    console.log(`${USED_MARKER}${JSON.stringify(m.used)}`);
    expect(m.violations).toEqual([]);
    expect(diffPermissions(declared, m.used, config).missing).toEqual([]);
  } finally {
    cleanup();
  }
}

export function runConformance(
  mod: ConformanceModule,
  seed?: ConformanceSeed,
  opts: ConformanceOptions = {},
): void {
  const parsed = ComponentManifest.safeParse(mod.manifest);
  const id = parsed.success ? parsed.data.id : "invalid";
  describe(`conformance v1 · ${id}`, () => {
    test("manifest is valid", () => {
      expect(parsed.success).toBe(true);
    });
    if (!parsed.success) return;
    const manifest = parsed.data;
    test("secrets are only requested for hosts covered by net", () => {
      expect(secretHostsCovered(manifest)).toEqual([]);
    });
    const declared = permissionList(grantedOf(manifest));
    const { runs, ...mockOpts } = opts;
    const projects: [string, ConformanceSeed | undefined, Partial<MockSdkOptions>][] = [
      ["empty project", undefined, {}],
      ["seeded project", seed, {}],
      [
        "shared project with provisional keys",
        seed,
        { shared: true, presence: [COLLEAGUE], members: [{ userId: "u-lea", name: "Léa", role: "editor" }] },
      ],
    ];
    const check = (options: MockSdkOptions) =>
      renderWithinPermissions(mod.Component, manifest, declared, options, runs, mockOpts.config ?? null);
    for (const format of formatsOf(manifest)) {
      const surface = surfaceFor(manifest, format);
      for (const theme of THEMES) {
        for (const [label, s, extra] of projects) {
          test(
            `renders an ${label} as ${format} (${surface}) in ${theme} within its declared permissions`,
            () =>
              withTheme(theme, () =>
                check({ ...mockOpts, ...extra, surface, format, ...(s && { seed: s }) }),
              ),
            RENDER_TEST_TIMEOUT_MS,
          );
        }
      }
    }
    const seeded = seed ? { seed } : {};
    if (manifest.capabilities.includes("fullscreen"))
      test(
        "renders in focus mode within its declared permissions",
        () => check({ ...mockOpts, ...seeded, focus: true }),
        RENDER_TEST_TIMEOUT_MS,
      );
    if (manifest.selection) {
      const firstTicketId = createMockSdk(manifest, seeded).snapshot().tickets[0]?.id;
      const selecting = firstTicketId ? test : test.skip;
      selecting(
        "renders with a selection within its declared permissions",
        () =>
          check({
            ...mockOpts,
            ...seeded,
            selection: firstTicketId ? { kind: "ticket", ids: [firstTicketId] } : null,
          }),
        RENDER_TEST_TIMEOUT_MS,
      );
    }
  });
}
