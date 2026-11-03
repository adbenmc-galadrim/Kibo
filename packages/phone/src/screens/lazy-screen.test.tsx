import { expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { lazyScreen } from "./lazy-screen";

function Agent({ name }: { name: string }) {
  return <h1>{`Agent de projet · ${name}`}</h1>;
}

test("a screen whose chunk fails to load says so in French and loads again with Réessayer", async () => {
  let attempts = 0;
  const Screen = lazyScreen(async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError("Failed to fetch dynamically imported module");
    return Agent;
  });
  render(<Screen name="Silo" />);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Impossible d'afficher cet écran");
  const retry = screen.getByRole("button", { name: "Réessayer" });
  expect(retry.className).toContain("min-h-11");
  fireEvent.click(retry);
  expect(await screen.findByRole("heading", { name: "Agent de projet · Silo" })).toBeTruthy();
  expect(attempts).toBe(2);
});

test("while the chunk loads, the screen shows Chargement…", async () => {
  let resolve: (screen: typeof Agent) => void = () => undefined;
  const Screen = lazyScreen(
    () =>
      new Promise<typeof Agent>((r) => {
        resolve = r;
      }),
  );
  render(<Screen name="Silo" />);
  expect(screen.getByText("Chargement…")).toBeTruthy();
  resolve(Agent);
  expect(await screen.findByRole("heading", { name: "Agent de projet · Silo" })).toBeTruthy();
});
