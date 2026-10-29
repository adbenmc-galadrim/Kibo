import { afterEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { AppSettingsProvider, fixedStore } from "../state/use-app-settings";
import { fac, kib, mineSnapshots, mineTicket, por } from "./fixtures";

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return Promise.resolve([]);
      },
      subscribeIntegrations: () => () => {},
    },
  }),
);
const { MyTicketsPage } = await import("./MyTicketsPage");

afterEach(cleanup);
const noop = () => undefined;

function page(onOpenTicket: (p: string, t: string) => void = noop, snapshots = mineSnapshots) {
  return render(
    <AppSettingsProvider store={fixedStore({ agentExecution: "hidden" })}>
      <MyTicketsPage
        viewer="adam"
        projects={[kib, por, fac]}
        snapshots={snapshots}
        onOpenTicket={onOpenTicket}
      />
    </AppSettingsProvider>,
  );
}

const keysOf = (name: string) =>
  within(screen.getByRole("region", { name }))
    .getAllByRole("button", { name: /^[A-Z]+-\d+ / })
    .map((b) => b.getAttribute("aria-label")?.split(" ")[0]);

test("my tickets is a work list: in progress, then waiting, each row names its project and its wait", async () => {
  page();
  expect(screen.getByText("9 tickets · 3 projets")).toBeTruthy();
  expect(
    screen.getAllByRole("heading", { level: 2 }).map((h) => h.querySelector("span")?.textContent),
  ).toEqual(["En cours", "En attente"]);
  expect(keysOf("En cours")).toEqual(["KIB-7", "KIB-11", "FAC-31"]);
  expect(keysOf("En attente")).toEqual(["KIB-21", "KIB-15", "KIB-9", "KIB-22", "POR-9", "FAC-34"]);
  const waiting = within(screen.getByRole("region", { name: "En attente" }));
  expect(waiting.getByText("attend KIB-12")).toBeTruthy();
  expect(waiting.getAllByText("Portfolio").length).toBe(1);
  await waitFor(() =>
    expect(calls.filter((c) => c.method === "listCiRuns").map((c) => c.projectId)).toEqual([
      "kib",
      "por",
      "fac",
    ]),
  );
});

test("a row opens its ticket and copies its /full-delivery command", async () => {
  const opened: string[] = [];
  page((p) => opened.push(p));
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^POR-9 / }));
  expect(opened).toEqual(["por"]);
  expect(screen.getByRole("button", { name: "Copier /full-delivery POR-9" })).toBeTruthy();
});

test("a step row names its feature F<n>, its branch and its delivery phase, a client demo reads « Démo · F4 »", () => {
  const feature = { ...mineTicket("KIB-40", "in_progress", null), title: "Envoi", shortKey: "F4" };
  const step = {
    ...mineTicket("KIB-46", "in_progress", { kind: "human", ref: "adam" }),
    title: "Démo client",
    parentId: feature.id,
    externalRefs: [{ kind: "git_branch" as const, branch: "feat/demo-f4", base: null }],
    delivery: { step: 7, note: "", at: 0, runId: null, kind: "delivery" as const },
  };
  const base = mineSnapshots.get(kib.id);
  if (!base) throw new Error("fixture without kib");
  page(noop, new Map([[kib.id, { ...base, tickets: [feature, step] }]]));
  const row = screen.getByRole("button", { name: /^KIB-46 / }).closest("li");
  if (!row) throw new Error("row not found");
  const cell = within(row);
  expect(cell.getByText("Démo · F4")).toBeTruthy();
  expect(cell.getByText("F4")).toBeTruthy();
  expect(cell.getByText("feat/demo-f4")).toBeTruthy();
  expect(row.querySelector("[data-delivery-step]")?.textContent).toBe("Phase 7/12 · Porte qualité");
});

test("the copy of a row says why its step cannot start yet", async () => {
  const { Toaster } = await import("@kibo/sdk/ui/sonner");
  const step = {
    ...mineTicket("KIB-47", "todo", { kind: "human", ref: "adam" }),
    startReason: { kind: "sprint" as const, code: "S43" },
  };
  const base = mineSnapshots.get(kib.id);
  if (!base) throw new Error("fixture without kib");
  render(<Toaster />);
  page(noop, new Map([[kib.id, { ...base, tickets: [step] }]]));
  await userEvent.setup().click(screen.getByRole("button", { name: "Copier /full-delivery KIB-47" }));
  expect(await screen.findByText("Copié · sprint S43")).toBeTruthy();
});
