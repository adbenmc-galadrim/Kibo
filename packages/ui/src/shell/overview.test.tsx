import { expect, mock, test } from "bun:test";
import type { ProjectSnapshot } from "@kibo/schema";
import { act, render, screen, within } from "@testing-library/react";
import { apiMock } from "../api-mock";
import { emisHomeSnapshot, summaryOf } from "./home-fixtures";

let emis: ProjectSnapshot = emisHomeSnapshot();
const listeners = new Set<(projectId: string | null) => void>();
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: { method: string; projectId?: string }) => {
        if (req.method === "getProject" && req.projectId === "emis") return emis;
        throw new Error(`unexpected rpc ${req.method}`);
      },
      subscribe: (listener: (projectId: string | null) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  }),
);

const { Overview } = await import("./Overview");

const NOW = new Date(2026, 9, 17, 10).getTime();
const project = summaryOf(emisHomeSnapshot());
const noInbox = { inboxCount: 0, onOpenInbox: () => {} };

const show = () =>
  render(<Overview viewer="adam" projects={[project]} now={NOW} onNewProject={() => {}} {...noInbox} />);

test("the home card shows the project key and client, never its folder", async () => {
  emis = emisHomeSnapshot();
  show();
  const card = await screen.findByRole("article", { name: "Emis" });
  expect(within(card).getByText("EMIS")).toBeTruthy();
  expect(within(card).getByText("client Emis SA")).toBeTruthy();
  expect(await within(card).findByText("bloqués")).toBeTruthy();
  expect(card.textContent).not.toContain("/Users/");
});

test("the home card counts blocked tickets with an open blocking question", async () => {
  emis = emisHomeSnapshot();
  show();
  const card = await screen.findByRole("article", { name: "Emis" });
  expect((await within(card).findByText("bloqués")).textContent).toBe("5 bloqués");
  expect(within(card).getByText("ouverts").textContent).toBe("7 ouverts");
  expect(within(card).getByText("en retard").textContent).toBe("1 en retard");
  expect(within(card).getByText("Sprint S42")).toBeTruthy();
  expect(within(card).getByRole("progressbar", { name: "1 terminé sur 8" })).toBeTruthy();
  expect(screen.getByText("1 projet · 7 tickets ouverts")).toBeTruthy();
});

test("the home card follows a status change without reloading", async () => {
  emis = emisHomeSnapshot();
  show();
  const card = await screen.findByRole("article", { name: "Emis" });
  await within(card).findByText("bloqués");
  emis = {
    ...emis,
    tickets: emis.tickets.map((t) => (t.id === "s1" ? { ...t, statusId: "done" as const } : t)),
  };
  await act(async () => {
    for (const listener of listeners) listener("emis");
  });
  expect((await within(card).findByText("bloqués")).textContent).toBe("4 bloqués");
  expect(within(card).getByText("ouverts").textContent).toBe("6 ouverts");
});

test("the home greets the viewer", async () => {
  emis = emisHomeSnapshot();
  show();
  expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Bonjour Adam");
  await screen.findByText("bloqués");
});

test("the home points to the inbox only when it holds open tickets", async () => {
  emis = emisHomeSnapshot();
  const opened: string[] = [];
  const { unmount } = show();
  await screen.findByText("bloqués");
  expect(screen.queryByRole("button", { name: /Boîte de réception/ })).toBeNull();
  unmount();
  render(
    <Overview
      viewer="adam"
      projects={[project]}
      now={NOW}
      onNewProject={() => {}}
      inboxCount={3}
      onOpenInbox={() => opened.push("inbox")}
    />,
  );
  await screen.findByText("bloqués");
  screen.getByRole("button", { name: "Boîte de réception · 3 tickets sans projet" }).click();
  expect(opened).toEqual(["inbox"]);
});
