import { describe, expect, test } from "bun:test";
import {
  ComponentManifest,
  diffPermissions,
  grantedOf,
  type ProjectCommand,
  type ProjectSnapshot,
  permissionList,
  type Surface,
  type Theme,
  type TicketRun,
  USED_MARKER,
} from "@kibo/schema";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { createMockSdk, type MockSdkOptions } from "./mock";
import { SdkProvider } from "./react";

export type ConformanceModule = { manifest: unknown; Component: ComponentType };
export type ConformanceSeed = (run: (cmd: ProjectCommand) => unknown) => void;
export type ConformanceOptions = Pick<
  MockSdkOptions,
  "fetch" | "server" | "notes" | "config" | "noteAges"
> & {
  runs?: (snapshot: ProjectSnapshot) => TicketRun[];
};

const THEMES: Theme[] = ["dark", "light"];
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

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
    const declared = permissionList(grantedOf(manifest));
    const surfaces: Surface[] = manifest.kind === "both" ? ["widget", "view"] : [manifest.kind];
    const { runs, ...mockOpts } = opts;
    const projects: [string, ConformanceSeed | undefined][] = [
      ["empty project", undefined],
      ["seeded project", seed],
    ];
    for (const surface of surfaces) {
      for (const theme of THEMES) {
        for (const [label, s] of projects) {
          test(`renders an ${label} as a ${surface} in ${theme} within its declared permissions`, async () => {
            document.documentElement.classList.toggle("dark", theme === "dark");
            const m = createMockSdk(manifest, { ...mockOpts, surface, ...(s && { seed: s }) });
            if (s && runs) m.setRuns(runs(m.snapshot()));
            const { container } = render(
              <SdkProvider sdk={m.sdk}>
                <mod.Component />
              </SdkProvider>,
            );
            try {
              await waitFor(() => expect(container.childElementCount).toBeGreaterThan(0));
              await settle();
              console.log(`${USED_MARKER}${JSON.stringify(m.used)}`);
              expect(m.violations).toEqual([]);
              expect(diffPermissions(declared, m.used).missing).toEqual([]);
            } finally {
              cleanup();
              document.documentElement.classList.remove("dark");
            }
          });
        }
      }
    }
  });
}
