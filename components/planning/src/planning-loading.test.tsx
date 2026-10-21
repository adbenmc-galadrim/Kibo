import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import type { EntityType } from "@kibo/schema";
import { type EntityMap, type KiboSdk, SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { Component, manifest } from "./index";
import { seedPlanning, TODAY } from "./test-seed";

beforeEach(() => setSystemTime(new Date(`${TODAY}T14:52:00`)));
afterEach(() => setSystemTime());

test("the Planning shows no column until its tickets are loaded", async () => {
  const m = createMockSdk(manifest, { today: TODAY, seed: (run) => void seedPlanning(run) });
  let releaseTickets = () => {};
  const ticketsHeld = new Promise<void>((resolve) => {
    releaseTickets = resolve;
  });
  const loaded: EntityType[] = [];
  const sdk: KiboSdk = {
    ...m.sdk,
    list: async <T extends EntityType>(type: T): Promise<EntityMap[T][]> => {
      if (type === "ticket") await ticketsHeld;
      const data = await m.sdk.list(type);
      loaded.push(type);
      return data;
    },
  };
  render(
    <SdkProvider sdk={sdk}>
      <Component />
    </SdkProvider>,
  );
  await waitFor(() =>
    expect(loaded).toEqual(expect.arrayContaining(["link", "sprint", "question", "project_event"])),
  );
  await act(async () => {});
  expect(screen.queryByRole("region", { name: "À planifier" })).toBeNull();
  expect(screen.queryByRole("status", { name: "Planning vide" })).toBeNull();
  releaseTickets();
  const backlog = await screen.findByRole("region", { name: "À planifier" });
  expect(within(backlog).getByRole("button", { name: /^F9 / })).toBeTruthy();
});
