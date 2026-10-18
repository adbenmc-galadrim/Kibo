import { expect, mock, test } from "bun:test";
import type { ProjectSnapshot } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import { apiMock } from "../api-mock";
import { emisHomeSnapshot, summaryOf } from "./home-fixtures";

const rpcCalls: string[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: { method: string }) => {
        rpcCalls.push(req.method);
        throw new Error(`unexpected rpc ${req.method}`);
      },
      subscribe: () => () => {},
    },
  }),
);

const { Overview } = await import("./Overview");

const NOW = new Date(2026, 9, 17, 10).getTime();
const project = summaryOf(emisHomeSnapshot());
const noInbox = { inboxCount: 0, onOpenInbox: () => {} };

const home = (snapshots: ReadonlyMap<string, ProjectSnapshot>, inbox = noInbox) => (
  <Overview
    viewer="adam"
    projects={[project]}
    snapshots={snapshots}
    now={NOW}
    onNewProject={() => {}}
    {...inbox}
  />
);
const loaded = (snapshot = emisHomeSnapshot()) => new Map([["emis", snapshot]]);
const countOf = async (card: HTMLElement, label: string) =>
  (await within(card).findByText(label)).textContent;

test("the home card shows the project key and client, never its folder", async () => {
  render(home(loaded()));
  const card = await screen.findByRole("article", { name: "Emis" });
  expect(within(card).getByText("EMIS")).toBeTruthy();
  expect(within(card).getByText("client Emis SA")).toBeTruthy();
  expect(card.textContent).not.toContain("/Users/");
});

test("the home card names what it counts: tickets, then features", async () => {
  render(home(loaded()));
  const card = await screen.findByRole("article", { name: "Emis" });
  expect(await countOf(card, "tickets ouverts")).toBe("7 tickets ouverts");
  expect(await countOf(card, "bloqués")).toBe("5 bloqués");
  expect(await countOf(card, "fonctionnalité en retard")).toBe("1 fonctionnalité en retard");
  expect(within(card).getByText("Sprint S42")).toBeTruthy();
  expect(within(card).getByRole("progressbar", { name: "1 terminé sur 8" })).toBeTruthy();
  expect(screen.getByText("1 projet · 7 tickets ouverts")).toBeTruthy();
});

test("the home card follows the workspace snapshots without loading them itself", async () => {
  const { rerender } = render(home(new Map()));
  const card = await screen.findByRole("article", { name: "Emis" });
  expect(within(card).queryByRole("progressbar")).toBeNull();
  rerender(home(loaded()));
  expect(await countOf(card, "bloqués")).toBe("5 bloqués");
  const changed = emisHomeSnapshot();
  rerender(
    home(
      loaded({
        ...changed,
        tickets: changed.tickets.map((t) => (t.id === "s1" ? { ...t, statusId: "done" as const } : t)),
      }),
    ),
  );
  expect(await countOf(card, "bloqués")).toBe("4 bloqués");
  expect(await countOf(card, "tickets ouverts")).toBe("6 tickets ouverts");
  expect(rpcCalls).toEqual([]);
});

test("the home greets the viewer", async () => {
  render(home(loaded()));
  expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Bonjour Adam");
});

test("the home points to the inbox only when it holds open tickets", async () => {
  const opened: string[] = [];
  const { unmount } = render(home(loaded()));
  await screen.findByRole("article", { name: "Emis" });
  expect(screen.queryByRole("button", { name: /Boîte de réception/ })).toBeNull();
  unmount();
  render(home(loaded(), { inboxCount: 3, onOpenInbox: () => opened.push("inbox") }));
  (await screen.findByRole("button", { name: "Boîte de réception · 3 tickets sans projet" })).click();
  expect(opened).toEqual(["inbox"]);
});
