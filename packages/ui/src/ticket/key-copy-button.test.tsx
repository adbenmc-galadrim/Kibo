import { afterEach, expect, jest, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyCopyButton } from "./KeyCopyButton";

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

const TICKET = { key: "SILO-45", keyLabel: "SILO-45" };

const stubClipboard = (written: string[]) =>
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  });

test("hover shows Copier SILO-45", async () => {
  render(<KeyCopyButton ticket={TICKET} />);
  await userEvent.setup().hover(screen.getByRole("button", { name: "Copier SILO-45" }));
  expect((await screen.findByRole("tooltip")).textContent).toContain("Copier SILO-45");
});

test("click copies and shows ✓ Copiée for 2 s, announced by aria-live", async () => {
  const written: string[] = [];
  stubClipboard(written);
  jest.useFakeTimers();
  render(<KeyCopyButton ticket={TICKET} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copier SILO-45" }));
  });
  expect(written).toEqual(["SILO-45"]);
  expect(screen.getByText("Copiée").closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite");
  expect(screen.queryByText("SILO-45")).toBeNull();
  act(() => {
    jest.advanceTimersByTime(1_999);
  });
  expect(screen.getByText("Copiée")).toBeTruthy();
  act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(screen.queryByText("Copiée")).toBeNull();
  expect(screen.getByText("SILO-45")).toBeTruthy();
});
