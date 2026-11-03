import { expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { createFakeRemote, ENABLED, PAIRING_CODE } from "./phone-fixtures";

const remote = createFakeRemote();
remote.status = ENABLED;
const drawn: { canvas: unknown; text: string }[] = [];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => remote.rpc(req),
      subscribe: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);
mock.module("qrcode", () => ({
  toCanvas: async (canvas: unknown, text: string) => {
    drawn.push({ canvas, text });
  },
}));
const { PhonePage } = await import("./PhonePage");

test('"Appairer un téléphone" opens the dialog with a QR (canvas) and the same code as text, and a 10 min countdown', async () => {
  render(<PhonePage />);
  await userEvent.click(await screen.findByRole("button", { name: "Appairer un téléphone" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Appairer un téléphone" }));
  expect(
    dialog.getByText(
      "Scanne ce code depuis l'application Kibo sur ton téléphone, ou colle-le. Il expire dans 10 min.",
    ),
  ).toBeTruthy();
  expect(await dialog.findByText(PAIRING_CODE)).toBeTruthy();
  expect(dialog.getByText("10:00")).toBeTruthy();
  await waitFor(() => expect(drawn).toHaveLength(1));
  const canvas = screen.getByRole("img", { name: "QR code d'appairage" });
  expect(canvas.tagName).toBe("CANVAS");
  expect(drawn[0]).toEqual({ canvas, text: PAIRING_CODE });
  expect(remote.calls.filter((c) => c.method === "remote.createPairing")).toHaveLength(1);
});
