import { afterEach, expect, test } from "bun:test";
import { act, fireEvent, screen } from "@testing-library/react";
import { mountDev } from "./dev";
import { useEntities, useSdk } from "./react";

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

test("mountDev renders the component on the demo data with surface and theme toggles", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await act(async () => mountDev(manifest, Probe));
  expect(await screen.findByText("widget · seeded")).toBeDefined();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Vue" })));
  expect(await screen.findByText("view · seeded")).toBeDefined();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sombre" })));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Clair" })));
  expect(document.documentElement.classList.contains("dark")).toBe(false);
});

test("mountDev rejects an invalid manifest", () => {
  expect(() => mountDev({ id: "Bad" }, Probe)).toThrow();
});
