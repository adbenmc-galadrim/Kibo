import { expect, test } from "bun:test";
import type { ProjectAsset } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen } from "@testing-library/react";
import { fr } from "./fr";
import { Component, manifest } from "./index";

runConformance({ manifest, Component }, seedDemo, { config: { model: null } });

const ROBOT: ProjectAsset = {
  name: "robot.glb",
  mime: "model/gltf-binary",
  kind: "model",
  size: 400,
  mtime: 0,
};

const mount = (model: string | null) => {
  const m = createMockSdk(manifest, { config: { model, autoRotate: true }, assets: [ROBOT] });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("without a model the widget asks for one in the settings", async () => {
  mount(null);
  expect(await screen.findByText(fr.empty)).toBeTruthy();
  cleanup();
});

test("a project model loads and falls back without webgl", async () => {
  const m = mount("robot.glb");
  expect(
    await screen.findByText("Affichage 3D indisponible sur cet appareil.", undefined, { timeout: 10_000 }),
  ).toBeTruthy();
  expect(await screen.findByText("robot.glb")).toBeTruthy();
  expect(m.used).toContain("cap:webgl");
  expect(m.used).toContain("cap:assets");
  expect(m.violations).toEqual([]);
  cleanup();
});

test("a model missing on this device is reported", async () => {
  mount("ghost.glb");
  expect(await screen.findByText(fr.missing, undefined, { timeout: 10_000 })).toBeTruthy();
  cleanup();
});
