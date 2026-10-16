import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
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

const step = { ticketId: "e34", key: "EMIS-34", title: "Tests E2E de l'envoi", blockedBy: ["EMIS-33"] };
const written: string[] = [];

beforeEach(() => {
  calls.length = 0;
  written.length = 0;
});
afterEach(cleanup);

const stubClipboard = (writeText: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

test("with agent execution hidden, the action copies the full-delivery command of the step", async () => {
  const user = userEvent.setup();
  stubClipboard(async (text) => void written.push(text));
  render(<NextStepAction projectId="emis" step={step} execution="hidden" />);
  expect(screen.getByText("Prochaine étape à livrer une fois EMIS-33 fusionné.")).toBeTruthy();
  expect(screen.getByText("/full-delivery EMIS-34")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Livrer la prochaine étape" }));
  expect(written).toEqual(["/full-delivery EMIS-34"]);
  expect(await screen.findByText("Commande copiée")).toBeTruthy();
  expect(calls).toEqual([]);
});

test("a refused clipboard says how to copy by hand", async () => {
  const user = userEvent.setup();
  stubClipboard(() => Promise.reject(new Error("denied")));
  render(<NextStepAction projectId="emis" step={step} execution="hidden" />);
  await user.click(screen.getByRole("button", { name: "Livrer la prochaine étape" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Copie refusée : sélectionne la commande à la main.",
  );
});

test("with agent execution shown, the action delivers the step through the queue", async () => {
  const user = userEvent.setup();
  render(<NextStepAction projectId="emis" step={{ ...step, blockedBy: [] }} execution="shown" />);
  expect(screen.getByText("Prochaine étape à livrer.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Livrer la prochaine étape" }));
  expect(calls).toEqual([{ method: "deliver", projectId: "emis", ticketId: "e34" }]);
});
