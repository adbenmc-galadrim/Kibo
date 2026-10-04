import { afterEach, expect, test } from "bun:test";
import { act, fireEvent, screen } from "@testing-library/react";
import { mountDev } from "./dev";
import { useEntities, useFocusMode, useSdk, useVisible } from "./react";

const manifest = {
  id: "acme.preview",
  version: "0.1.0",
  kind: "both",
  title: "Preview",
  description: "Aperçu",
  reads: ["ticket"],
  writes: [],
  changes: [],
};

function Probe() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  return (
    <p>
      {sdk.surface} · {tickets.data.length > 0 ? "seeded" : "empty"}
    </p>
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

const frameOf = (text: string) => screen.getByText(text).closest<HTMLElement>("[data-format]");

test("mountDev renders the component on the demo data with format and theme toggles", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await act(async () => mountDev(manifest, Probe));
  expect(await screen.findByText("widget · seeded")).toBeDefined();
  expect(
    screen
      .getAllByRole("button", { name: /^(Petit|Moyen|Large|Demi-page|Plein écran)$/ })
      .map((b) => b.textContent),
  ).toEqual(["Moyen", "Large", "Demi-page", "Plein écran"]);
  const medium = frameOf("widget · seeded");
  expect([medium?.dataset.format, medium?.style.width, medium?.style.height]).toEqual([
    "medium",
    "592px",
    "272px",
  ]);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Plein écran" })));
  expect(await screen.findByText("view · seeded")).toBeDefined();
  const full = frameOf("view · seeded");
  expect([full?.dataset.format, full?.style.width, full?.style.height]).toEqual(["full", "1200px", "848px"]);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sombre" })));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Clair" })));
  expect(document.documentElement.classList.contains("dark")).toBe(false);
});

test("mountDev offers only the declared formats", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await act(async () => mountDev({ ...manifest, kind: "widget", formats: ["small", "large"] }, Probe));
  expect(await screen.findByText("widget · seeded")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Moyen" })).toBeNull();
  const large = frameOf("widget · seeded");
  expect([large?.dataset.format, large?.style.width, large?.style.height]).toEqual([
    "large",
    "592px",
    "560px",
  ]);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Petit" })));
  const small = frameOf("widget · seeded");
  expect([small?.dataset.format, small?.style.width, small?.style.height]).toEqual([
    "small",
    "288px",
    "272px",
  ]);
});

function ModeProbe() {
  const visible = useVisible();
  const focus = useFocusMode();
  return (
    <p>
      {visible ? "visible" : "hidden"} · {focus.active ? "focused" : "inline"}
    </p>
  );
}

test("mountDev toggles visibility, and focus mode when the component declares it", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await act(async () => mountDev({ ...manifest, capabilities: ["fullscreen"] }, ModeProbe));
  expect(await screen.findByText("visible · inline")).toBeDefined();
  const visibleToggle = screen.getByRole("button", { name: "Visible" });
  expect(visibleToggle.getAttribute("aria-pressed")).toBe("true");
  await act(async () => fireEvent.click(visibleToggle));
  expect(await screen.findByText("hidden · inline")).toBeDefined();
  expect(visibleToggle.getAttribute("aria-pressed")).toBe("false");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mode plein écran" })));
  expect(await screen.findByText("hidden · focused")).toBeDefined();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Large" })));
  expect(await screen.findByText("hidden · focused")).toBeDefined();
});

test("mountDev hides the focus toggle without the fullscreen capability", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await act(async () => mountDev(manifest, ModeProbe));
  expect(await screen.findByText("visible · inline")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Mode plein écran" })).toBeNull();
});

test("mountDev rejects an invalid manifest", () => {
  expect(() => mountDev({ id: "Bad" }, Probe)).toThrow();
});
