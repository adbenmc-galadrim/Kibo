import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest, SignalsView } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NOW } from "../../agents/fixtures";
import { formatClock } from "../../agents/format";
import { apiMock } from "../../api-mock";
import { pendingBatch } from "../fixtures";
import { CLOSED_SIGNAL, emptySignals, OPEN_SIGNALS, signalsView } from "./fixtures";

const calls: RpcRequest[] = [];
let current: SignalsView = signalsView();

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "listSignals") return Promise.resolve(current);
        if (req.method === "ignoreSignal") {
          current = { ...current, signals: current.signals.filter((s) => s.id !== req.signalId) };
          return Promise.resolve({ ...OPEN_SIGNALS[0], status: "ignored" });
        }
        return Promise.reject(new Error(`unexpected ${req.method}`));
      },
      subscribeTopic: () => () => {},
    },
  }),
);

const { SignalBox } = await import("./SignalBox");
const { useSignals } = await import("./use-signals");

const batches = [
  pendingBatch({
    id: "b2",
    seq: 2,
    status: "applied",
    results: [{ actionId: 1, outcome: "applied", detail: null, created: { ticketId: "t31", key: "KIB-31" } }],
  }),
];

const opened: string[] = [];

function Box() {
  const signals = useSignals("kibo");
  return <SignalBox projectId="kibo" signals={signals} batches={batches} onTicket={(k) => opened.push(k)} />;
}

beforeEach(() => {
  calls.length = 0;
  opened.length = 0;
  current = signalsView();
});

const section = (name: string) => within(screen.getByRole("region", { name }));

test("open signals, the wakeup line and the closed ones each have their section", async () => {
  render(<Box />);
  const box = within(await screen.findByRole("region", { name: "En boîte · 3" }));
  expect(box.getAllByRole("listitem")).toHaveLength(3);
  expect(
    section("Réveil automatique").getByText(`prochain réveil à ${formatClock(NOW - 4 * 60_000)}`),
  ).toBeTruthy();
  const closed = section("Traités");
  expect(closed.getByText("traité dans le lot n° 2 · KIB-31")).toBeTruthy();
  expect(closed.getByText(`« ${CLOSED_SIGNAL.title} »`)).toBeTruthy();
});

test("a row shows the kind, the run, the ticket, the time and the title; the body unfolds", async () => {
  render(<Box />);
  const user = userEvent.setup();
  const box = within(await screen.findByRole("region", { name: "En boîte · 3" }));
  const row = within(box.getAllByRole("listitem")[2] as HTMLElement);
  expect(row.getByText("Ticket à créer")).toBeTruthy();
  expect(row.getByRole("button", { name: /opus-dev-2/ })).toBeTruthy();
  expect(row.getByText(formatClock(NOW - 19 * 60_000))).toBeTruthy();
  expect(row.queryByText("Le récepteur n'a aucun test d'intégration.")).toBeNull();
  await user.click(row.getByRole("button", { name: "« Tests du récepteur de hooks »" }));
  expect(row.getByText("Le récepteur n'a aucun test d'intégration.")).toBeTruthy();
  const blocker = within(box.getAllByRole("listitem")[1] as HTMLElement);
  expect(blocker.getByText("Blocage").className).toContain("text-destructive");
  await user.click(blocker.getByRole("button", { name: "KIB-16" }));
  await user.click(blocker.getByRole("button", { name: "Ouvrir le ticket" }));
  expect(opened).toEqual(["KIB-16", "KIB-16"]);
});

test("Ignorer calls ignoreSignal then reloads the box", async () => {
  render(<Box />);
  const user = userEvent.setup();
  const box = within(await screen.findByRole("region", { name: "En boîte · 3" }));
  const row = within(box.getAllByRole("listitem")[2] as HTMLElement);
  await user.click(row.getByRole("button", { name: "Ignorer" }));
  await waitFor(() =>
    expect(calls.filter((c) => c.method === "ignoreSignal")).toEqual([
      { method: "ignoreSignal", projectId: "kibo", signalId: "s1" },
    ]),
  );
  expect(await screen.findByRole("region", { name: "En boîte · 2" })).toBeTruthy();
});

test("an empty box explains what will land here and that no wakeup is planned", async () => {
  current = emptySignals();
  render(<Box />);
  expect(
    await screen.findByText(
      "Aucun signal. Les agents de ticket te signaleront ici tickets à créer, blocages, contexte et questions.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("aucun réveil prévu")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Traités" })).toBeNull();
});
