import { afterEach, beforeEach, expect, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import { App } from "../../App";
import { phoneFixture } from "../../app-test-kit";

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "#/p/silo/graph";
});

afterEach(cleanup);

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
