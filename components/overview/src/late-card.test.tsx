import { afterEach, expect, setSystemTime, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { NOW, seed, TODAY } from "./test-seed";

afterEach(() => {
  setSystemTime();
  cleanup();
});

function setup(today: string) {
  setSystemTime(new Date(Date.parse(`${today}T14:52:00`)));
  const m = createMockSdk(manifest, { seed, today, folder: "/silo" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
}

test("between two sprints, the late features are listed under the deadlines and open on click", async () => {
  const m = setup("2026-10-18");
  const late = await screen.findByRole("region", { name: "En retard" });
  expect(within(late).getByText("sprint fini, étapes obligatoires restantes")).toBeTruthy();
  const rows = within(late).getAllByRole("listitem");
  expect(rows.map((r) => r.textContent)).toEqual([
    expect.stringContaining("F4Saisir un constat hors ligneS42· terminé le 16 oct.reste 1 étape"),
    expect.stringContaining("F5Envoyer les photos d'un constatS42· terminé le 16 oct.reste 4 étapes"),
  ]);
  await userEvent.click(within(late).getByRole("button", { name: "Envoyer les photos d'un constat" }));
  const f5 = m.snapshot().tickets.find((t) => t.title === "Envoyer les photos d'un constat");
  expect(m.opened).toEqual([f5?.id ?? ""]);
  const indicators = screen.getByRole("region", { name: "Indicateurs du projet" });
  expect(within(indicators).getByText("2 en retard")).toBeTruthy();
  const sprint = screen.getByRole("region", { name: "Dernier sprint · S42 terminé" });
  expect(within(sprint).getByText("S43 commence lun. 19 oct.")).toBeTruthy();
});

test("while the sprint runs, no late card is shown", async () => {
  expect(NOW).toBe(Date.parse(`${TODAY}T14:52:00`));
  setup(TODAY);
  await screen.findByRole("region", { name: "Échéances" });
  await waitFor(() => expect(screen.getByRole("region", { name: "Indicateurs du projet" })).toBeTruthy());
  expect(screen.queryByRole("region", { name: "En retard" })).toBeNull();
});
