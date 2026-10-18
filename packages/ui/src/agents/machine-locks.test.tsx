import { expect, test } from "bun:test";
import type { LockTicket, MachineLock } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import { NOW } from "./fixtures";
import { MachineLocks } from "./MachineLocks";

const MIN = 60_000;
const ticket = (over: Partial<LockTicket> & Pick<LockTicket, "ticket" | "label">): LockTicket => ({
  pid: 100,
  since: NOW - 3 * MIN,
  cwd: "/Users/adam/Documents/silo/silo-feat-compte-non-provisionne",
  alive: true,
  ...over,
});

const LOCKS: MachineLock[] = [
  {
    name: "heavy",
    max: 2,
    held: [
      ticket({ ticket: "silo:SILO-15", label: "gates" }),
      ticket({ ticket: "atlas:C5-3", label: "build", since: NOW - 6 * MIN, alive: false }),
    ],
    waiting: [ticket({ ticket: "silo:SILO-20", label: "gates", since: NOW - MIN })],
  },
  { name: "review", max: 3, held: [ticket({ ticket: "silo:SILO-21", label: "review-pr" })], waiting: [] },
  { name: "demo", max: 1, held: [], waiting: [] },
];

test("one card per lock with its occupancy, one line per ticket with its state", () => {
  render(<MachineLocks locks={LOCKS} now={NOW} />);
  const section = within(screen.getByRole("region", { name: "Verrous de la machine" }));
  expect(section.getAllByRole("article").map((g) => g.getAttribute("aria-label"))).toEqual([
    "heavy · 2/2 occupés · 1 en attente",
    "review · 1/3 occupés",
    "demo · 0/1 occupés",
  ]);
  const heavy = within(section.getByRole("article", { name: /^heavy/ }));
  expect(heavy.getAllByRole("listitem").map((l) => within(l).getByTestId("lock-state").textContent)).toEqual([
    "tenu",
    "mort",
    "en attente",
  ]);
  const line = (text: string) => {
    const li = heavy.getByText(text).closest("li");
    if (li === null) throw new Error(`no line for ${text}`);
    return within(li);
  };
  expect(line("silo:SILO-15 gates").getByText("3m")).toBeTruthy();
  expect(
    line("silo:SILO-15 gates").getByText("~/Documents/silo/silo-feat-compte-non-provisionne"),
  ).toBeTruthy();
  expect(line("atlas:C5-3 build").getByTestId("lock-state").className).toContain("text-red");
  expect(within(section.getByRole("article", { name: /^demo/ })).getByText("Libre")).toBeTruthy();
  expect(section.getByText(/~\/\.delivery\/slots/)).toBeTruthy();
});

test("no lock on the machine says so with the folder read", () => {
  render(<MachineLocks locks={[]} now={NOW} />);
  const section = within(screen.getByRole("region", { name: "Verrous de la machine" }));
  expect(section.getByText("Aucun verrou de livraison sur cette machine.")).toBeTruthy();
  expect(section.getByText(/~\/\.delivery\/slots/)).toBeTruthy();
  expect(section.queryAllByRole("article")).toEqual([]);
});

test("the header names the folder the daemon actually reads", () => {
  render(<MachineLocks locks={[]} now={NOW} dir="~/locks" />);
  const section = within(screen.getByRole("region", { name: "Verrous de la machine" }));
  expect(section.getByText("lus dans ~/locks toutes les 2 s · lecture seule")).toBeTruthy();
});
