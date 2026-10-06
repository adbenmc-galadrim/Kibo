import { expect, spyOn, test } from "bun:test";
import { KiboError, type ProjectAsset } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const FALLBACK = "Affichage 3D indisponible sur cet appareil.";
const user = userEvent.setup();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fallback = () => screen.findByText(FALLBACK, undefined, { timeout: 10_000 });

const mount = (model: string | null) => {
  const m = createMockSdk(manifest, { config: { model, autoRotate: true }, assets: [ROBOT] });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const openPanel = async () => {
  await user.click(screen.getByRole("button", { name: "Éclairage" }));
  return within(await screen.findByRole("form", { name: "Réglages d'éclairage" }));
};

test("without a model the widget asks for one in the settings", async () => {
  mount(null);
  expect(await screen.findByText(fr.empty)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Éclairage" })).toBeNull();
  cleanup();
});

test("a project model loads and falls back without webgl", async () => {
  const m = mount("robot.glb");
  expect(await fallback()).toBeTruthy();
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

test("a lighting change does not fetch the model again", async () => {
  const m = createMockSdk(manifest, { config: { model: ROBOT.name, autoRotate: false }, assets: [ROBOT] });
  const url = spyOn(m.sdk.assets, "url");
  const { rerender } = render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await fallback();
  expect(url).toHaveBeenCalledTimes(1);
  rerender(
    <SdkProvider
      sdk={{ ...m.sdk, config: { model: ROBOT.name, autoRotate: false, lighting: "studio", shadows: true } }}
    >
      <Component />
    </SdkProvider>,
  );
  await fallback();
  expect(url).toHaveBeenCalledTimes(1);
  rerender(
    <SdkProvider sdk={{ ...m.sdk, config: { model: "autre.glb" } }}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByText(fr.missing, undefined, { timeout: 10_000 });
  expect(url).toHaveBeenCalledTimes(2);
  cleanup();
});

test("the lighting panel is collapsed by default and opens from its button", async () => {
  const m = mount("robot.glb");
  await fallback();
  const toggle = screen.getByRole("button", { name: "Éclairage" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("form", { name: "Réglages d'éclairage" })).toBeNull();
  await user.click(toggle);
  const panel = within(await screen.findByRole("form", { name: "Réglages d'éclairage" }));
  expect(panel.getByRole("radio", { name: "Doux" }).getAttribute("aria-checked")).toBe("true");
  expect(panel.getByRole<HTMLInputElement>("slider", { name: "Intensité" }).value).toBe("1");
  expect(panel.getByText("1,0×")).toBeTruthy();
  expect(panel.getByRole("switch", { name: "Ombres" }).getAttribute("aria-checked")).toBe("false");
  expect(panel.getByRole("switch", { name: "Lumière d'ambiance" }).getAttribute("aria-checked")).toBe("true");
  expect(m.configPatches).toEqual([]);
  cleanup();
});

test("the lighting panel saves once per burst, with the four keys", async () => {
  const m = mount("robot.glb");
  await fallback();
  const panel = await openPanel();
  await user.click(panel.getByRole("radio", { name: "Studio" }));
  await user.click(panel.getByRole("switch", { name: "Ombres" }));
  fireEvent.change(panel.getByRole("slider", { name: "Intensité" }), { target: { value: "1.5" } });
  expect(panel.getByRole("radio", { name: "Studio" }).getAttribute("aria-checked")).toBe("true");
  expect(panel.getByText("1,5×")).toBeTruthy();
  expect(m.configPatches).toEqual([]);
  await wait(350);
  expect(m.configPatches).toEqual([
    { lighting: "studio", lightIntensity: 1.5, shadows: true, environment: true },
  ]);
  cleanup();
});

test("an unmount flushes the pending write", async () => {
  const m = mount("robot.glb");
  await fallback();
  const panel = await openPanel();
  await user.click(panel.getByRole("radio", { name: "Contraste" }));
  cleanup();
  await wait(0);
  expect(m.configPatches).toHaveLength(1);
  expect(m.configPatches[0]).toMatchObject({ lighting: "contrast" });
});

test("a refused save keeps the live value and says so", async () => {
  const m = mount("robot.glb");
  const error = spyOn(console, "error").mockImplementation(() => {});
  spyOn(m.sdk, "setConfig").mockRejectedValue(new KiboError("CONFLICT", "read only"));
  await fallback();
  const panel = await openPanel();
  await user.click(panel.getByRole("radio", { name: "Contraste" }));
  await wait(350);
  expect((await panel.findByRole("alert")).textContent).toBe("Réglage non enregistré.");
  expect(panel.getByRole("radio", { name: "Contraste" }).getAttribute("aria-checked")).toBe("true");
  expect(error).toHaveBeenCalled();
  error.mockRestore();
  cleanup();
});

test("the panel follows the settings dialog when nothing is pending", async () => {
  const m = createMockSdk(manifest, { config: { model: ROBOT.name, autoRotate: false }, assets: [ROBOT] });
  const { rerender } = render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await fallback();
  const panel = await openPanel();
  expect(panel.getByRole("radio", { name: "Doux" }).getAttribute("aria-checked")).toBe("true");
  rerender(
    <SdkProvider
      sdk={{
        ...m.sdk,
        config: { model: ROBOT.name, autoRotate: false, lighting: "contrast", shadows: true },
      }}
    >
      <Component />
    </SdkProvider>,
  );
  expect(panel.getByRole("radio", { name: "Contraste" }).getAttribute("aria-checked")).toBe("true");
  expect(panel.getByRole("switch", { name: "Ombres" }).getAttribute("aria-checked")).toBe("true");
  expect(m.configPatches).toEqual([]);
  cleanup();
});

test("the panel is reachable by keyboard", async () => {
  mount("robot.glb");
  await fallback();
  screen.getByRole("button", { name: "Éclairage" }).focus();
  await user.keyboard("{Enter}");
  await screen.findByRole("form", { name: "Réglages d'éclairage" });
  await user.tab();
  expect(document.activeElement?.getAttribute("role")).toBe("radio");
  cleanup();
});
