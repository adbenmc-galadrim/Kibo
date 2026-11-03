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
