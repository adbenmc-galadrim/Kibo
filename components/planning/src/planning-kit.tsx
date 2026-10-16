import { SdkProvider } from "@kibo/sdk";
import { createMockSdk, type MockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { render, screen, within } from "@testing-library/react";
import { Component, manifest } from "./index";
import { seedPlanning, TODAY } from "./test-seed";

export type PlanningSetup = { m: MockSdk; seeded: ReturnType<typeof seedPlanning> };

export function setupPlanning(today = TODAY, opts: MockSdkOptions = {}): PlanningSetup {
  let seeded: ReturnType<typeof seedPlanning> | undefined;
  const m = createMockSdk(manifest, {
    ...opts,
    today,
    seed: (run) => {
      seeded = seedPlanning(run);
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
