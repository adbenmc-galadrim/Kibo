import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest, StartReason } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../../api-mock";

const calls: RpcRequest[] = [];

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        return { kind: "run", run: null };
      },
      subscribeTopic: () => () => {},
    },
  }),
);

const { NextStepAction } = await import("./NextStepAction");

const step = { ticketId: "e34", key: "EMIS-34", title: "Tests E2E de l'envoi", blockedBy: [] };
const written: string[] = [];

beforeEach(() => {
  calls.length = 0;
  written.length = 0;
});
afterEach(cleanup);

const stubClipboard = (writeText: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

test("with agent execution hidden, « Copier la commande » copies the full-delivery command of the step", async () => {
  const user = userEvent.setup();
  stubClipboard(async (text) => void written.push(text));
  render(<NextStepAction projectId="emis" step={step} reason={null} execution="hidden" />);
  expect(screen.getByText("Prochaine étape à livrer.")).toBeTruthy();
  expect(screen.getByText("/full-delivery EMIS-34")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Copier la commande" }));
  expect(written).toEqual(["/full-delivery EMIS-34"]);
  expect(await screen.findByText("Commande copiée")).toBeTruthy();
  expect(calls).toEqual([]);
});

test("a refused clipboard says how to copy by hand", async () => {
  const user = userEvent.setup();
  stubClipboard(() => Promise.reject(new Error("denied")));
  render(<NextStepAction projectId="emis" step={step} reason={null} execution="hidden" />);
  await user.click(screen.getByRole("button", { name: "Copier la commande" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Copie refusée : sélectionne la commande à la main.",
  );
});

test("with agent execution shown, the action delivers the step through the queue", async () => {
  const user = userEvent.setup();
  render(<NextStepAction projectId="emis" step={step} reason={null} execution="shown" />);
  expect(screen.getByText("Prochaine étape à livrer.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Livrer la prochaine étape" }));
  expect(calls).toEqual([{ method: "deliver", projectId: "emis", ticketId: "e34" }]);
});

test("a step that cannot start yet shows its reason, with nothing to copy", () => {
  const reason: StartReason = { kind: "dependency", keys: ["EMIS-33"] };
  render(<NextStepAction projectId="emis" step={step} reason={reason} execution="hidden" />);
  expect(screen.getByText("Prochaine étape EMIS-34 : attend EMIS-33.")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByText("/full-delivery EMIS-34")).toBeNull();
});

test("each reason is said in words: sprint, limit, question", () => {
  const cases: [StartReason, string][] = [
    [{ kind: "sprint", code: "S43" }, "Prochaine étape EMIS-34 : sprint S43."],
    [{ kind: "limit", limit: 2, count: 2 }, "Prochaine étape EMIS-34 : limite 2/2 atteinte."],
    [{ kind: "question", label: "Q1" }, "Prochaine étape EMIS-34 : bloqué par Q1."],
    [{ kind: "status" }, "Aucune étape démarrable pour l'instant."],
  ];
  for (const [reason, text] of cases) {
    render(<NextStepAction projectId="emis" step={step} reason={reason} execution="hidden" />);
    expect(screen.getByText(text)).toBeTruthy();
    cleanup();
  }
});
