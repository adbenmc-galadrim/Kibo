import { beforeEach, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { App } from "../../App";
import { siloFixture } from "../../screen-fixture";

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "#/p/silo/dashboard";
});

test("DashboardScreen renders OverviewView stacked (data-slot overview-columns has flex-col below 2xl)", async () => {
  const { runtime } = await siloFixture();
  render(<App runtime={runtime} />);
  const indicators = await screen.findByRole("region", { name: "Indicateurs du projet" });
  const root = indicators.closest(".\\@container");
  expect(root).not.toBeNull();
  const columns = Array.from(root?.querySelectorAll("[data-slot='overview-columns']") ?? []);
  expect(columns.length).toBeGreaterThan(0);
  for (const c of columns) expect(c.className.split(" ")).toContain("@max-2xl:flex-col");
  expect(screen.getAllByRole("banner")[0]?.textContent).toContain("Dashboard");
});

test("the dashboard offers no project editing", async () => {
  const { runtime } = await siloFixture();
  render(<App runtime={runtime} />);
  await screen.findByRole("region", { name: "Indicateurs du projet" });
  expect(screen.queryByRole("button", { name: /Modifier le projet/ })).toBeNull();
});
