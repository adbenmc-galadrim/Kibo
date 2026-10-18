import { expect, test } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import { emitToast } from "../toast-bus";
import { Toaster } from "./sonner";

test("the toaster shows the toasts a component emits through the SDK", async () => {
  render(<Toaster />);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  act(() => emitToast("Copié · attend SILO-33"));
  expect(await screen.findByText("Copié · attend SILO-33")).toBeDefined();
});
