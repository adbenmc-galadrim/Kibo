import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { manifest } from "@kibo/component-graph";
import { SEED_TODAY, seedSprintGraph } from "@kibo/component-graph/seeds";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import { App } from "../../App";
import { phoneFixture } from "../../app-test-kit";
import { putBlob } from "../../fake-server-api";
import { sealJson } from "../../test-kit";

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "#/p/silo/graph";
});

afterEach(() => {
  cleanup();
  setSystemTime();
});

test("the Graphe tab mounts the graph component on the project snapshot of the phone", async () => {
  const { runtime } = await phoneFixture();
  render(<App runtime={runtime} />);
  const main = await screen.findByRole("main");
  const views = await within(main).findByRole("group", { name: "Vue" });
  expect(within(views).getByRole("radio", { name: "Fonctionnalités" })).toHaveProperty("checked", true);
  expect(within(main).getByRole("button", { name: "Tout voir" })).toBeTruthy();
  expect(await within(main).findByText("Les fonctionnalités et leurs étapes apparaissent ici.")).toBeTruthy();
});

test("on the Graphe tab the main area is a flex column that does not scroll, so each column scrolls alone", async () => {
  const { runtime } = await phoneFixture();
  render(<App runtime={runtime} />);
  const main = await screen.findByRole("main");
  await within(main).findByRole("group", { name: "Vue" });
  for (const cls of ["flex", "flex-col", "overflow-hidden"]) expect(main.className).toContain(cls);
  expect(main.className).not.toContain("overflow-y-auto");
  expect(main.firstElementChild?.className).toContain("flex-1");
});

test("a snapshot sent before the end of a sprint shows its features late once the sprint is over", async () => {
  const m = createMockSdk(manifest, { seed: seedSprintGraph, today: SEED_TODAY });
  const sent = m.snapshot();
  const importing = sent.tickets.find((t) => t.title === "Importer les box depuis Excel");
  expect(importing?.feature?.status).toBe("todo");
  const silo = { ...sent, meta: { ...sent.meta, id: "silo", key: "SILO", name: "Silo" } };
  setSystemTime(new Date("2026-10-26T10:00:00"));
  const { api, keys, runtime } = await phoneFixture();
  putBlob(api, await sealJson(keys, "silo", "project", silo, { seq: 2 }));
  render(<App runtime={runtime} />);
  const frame = await screen.findByRole("article", { name: /Importer les box depuis Excel/ });
  expect(frame.getAttribute("data-late")).toBe("true");
  expect(frame.className).toContain("border-(--tracking-red)");
  expect(frame.textContent).toContain("en retard · glisse en S44");
  const onTime = screen.getByRole("article", { name: /Rapport de centre journalier/ });
  expect(onTime.hasAttribute("data-late")).toBe(false);
});
