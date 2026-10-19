import type { ProjectCommand, ProjectEvent } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk, type MockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { render, screen, within } from "@testing-library/react";
import { Component, manifest } from "./index";
import { seedPlanning, TODAY } from "./test-seed";

export type PlanningSetup = { m: MockSdk; seeded: ReturnType<typeof seedPlanning> };

type Seeded = ReturnType<typeof seedPlanning>;
type PlanningOptions = MockSdkOptions & {
  journal?: (seeded: Seeded) => ProjectEvent[];
  seedWith?: (run: (cmd: ProjectCommand) => unknown) => Seeded;
};

export function setupPlanning(today = TODAY, opts: PlanningOptions = {}): PlanningSetup {
  let seeded: Seeded | undefined;
  const { journal, seedWith = seedPlanning, ...rest } = opts;
  const events: ProjectEvent[] = [];
  const m = createMockSdk(manifest, {
    ...rest,
    events,
    today,
    seed: (run) => {
      seeded = seedWith(run);
      events.push(...(journal?.(seeded) ?? []));
    },
  });
  if (!seeded) throw new Error("seed missing");
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return { m, seeded };
}

export const column = (name: RegExp | string) => screen.findByRole("region", { name });

export async function cardIn(columnName: RegExp | string, shortKey: string): Promise<HTMLElement> {
  const region = await column(columnName);
  return within(region).getByRole("button", { name: new RegExp(`^${shortKey} `) });
}
