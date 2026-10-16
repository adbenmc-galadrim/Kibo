import type { EntityType } from "@kibo/schema";
import { type EntityMap, type KiboSdk, SdkProvider } from "@kibo/sdk";
import { createMockSdk, type MockSdk } from "@kibo/sdk/mock";
import { render, screen, within } from "@testing-library/react";
import { Component, manifest } from "./index";
import { seedPlanning, TODAY, withSprintCode } from "./test-seed";

const isSprint = <E,>(e: E): e is E & { name: string; start: string } =>
  typeof e === "object" && e !== null && "start" in e && "name" in e;

export function withSprintCodes(sdk: KiboSdk): KiboSdk {
  const list = async <T extends EntityType>(type: T): Promise<EntityMap[T][]> =>
    (await sdk.list(type)).map((e) => (isSprint(e) ? withSprintCode(e) : e));
  return { ...sdk, list };
}

export type PlanningSetup = { m: MockSdk; seeded: ReturnType<typeof seedPlanning> };

export function setupPlanning(today = TODAY): PlanningSetup {
  let seeded: ReturnType<typeof seedPlanning> | undefined;
  const m = createMockSdk(manifest, {
    today,
    seed: (run) => {
      seeded = seedPlanning(run);
    },
  });
  if (!seeded) throw new Error("seed missing");
  render(
    <SdkProvider sdk={withSprintCodes(m.sdk)}>
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
