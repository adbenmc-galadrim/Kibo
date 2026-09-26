import { describe, expect, test } from "bun:test";
import { ComponentManifest, type ProjectCommand, type ProjectSnapshot, type TicketRun } from "@kibo/schema";
import { cleanup, render, waitFor } from "@testing-library/react";
import { createMockSdk } from "./mock";
import { SdkProvider } from "./react";
import type { ComponentModule } from "./types";

export function runConformance(
  mod: ComponentModule,
  seed?: (run: (cmd: ProjectCommand) => unknown) => void,
  runs?: (snapshot: ProjectSnapshot) => TicketRun[],
): void {
  describe(`conformance v0 · ${mod.manifest.id}`, () => {
    test("manifest is valid", () => {
      expect(ComponentManifest.safeParse(mod.manifest).success).toBe(true);
    });

    for (const [label, s] of [
      ["empty project", undefined],
      ["seeded project", seed],
    ] as const) {
      test(`renders an ${label} within its declared permissions`, async () => {
        const m = createMockSdk(mod.manifest, s ? { seed: s } : {});
        if (s && runs) m.setRuns(runs(m.snapshot()));
        const { container } = render(
          <SdkProvider sdk={m.sdk}>
            <mod.Component />
          </SdkProvider>,
        );
        await waitFor(() => expect(container.childElementCount).toBeGreaterThan(0));
        expect(m.violations).toEqual([]);
        cleanup();
      });
    }
  });
}
