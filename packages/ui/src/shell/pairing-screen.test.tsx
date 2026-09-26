import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const codes: string[] = [];
let outcome: () => Promise<void> = () => Promise.resolve();
mock.module("../api", () => ({
  client: {
    pairWithCode: (code: string) => {
      codes.push(code);
      return outcome();
    },
  },
}));
const { PairingScreen } = await import("./PairingScreen");

const values = () => screen.getAllByRole("textbox").map((b) => (b as HTMLInputElement).value);

beforeEach(() => {
  codes.length = 0;
  outcome = () => Promise.resolve();
});

test("six boxes, typing advances, submit sends the normalised code", async () => {
  const paired = mock(() => {});
  render(<PairingScreen onPaired={paired} />);
  const boxes = screen.getAllByRole("textbox");
  expect(boxes).toHaveLength(6);
  await userEvent.type(boxes[0] as HTMLElement, "k7q4m2");
  expect(values().join("")).toBe("K7Q4M2");
  await userEvent.click(screen.getByRole("button", { name: "Appairer" }));
  expect(codes).toEqual(["K7Q4M2"]);
  expect(paired).toHaveBeenCalledTimes(1);
});

test("pasting a formatted code fills every box", async () => {
  render(<PairingScreen onPaired={() => {}} />);
  (screen.getAllByRole("textbox")[0] as HTMLInputElement).focus();
  await userEvent.paste("k7q-4m2");
  expect(values().join("")).toBe("K7Q4M2");
});

test("backspace on an empty box clears the previous one", async () => {
  render(<PairingScreen onPaired={() => {}} />);
  await userEvent.type(screen.getAllByRole("textbox")[0] as HTMLElement, "K7Q");
  await userEvent.keyboard("{Backspace}");
  expect(values().join("")).toBe("K7");
});

test("a refused code shows the error and stays on the screen", async () => {
  outcome = () => Promise.reject(new KiboError("UNAUTHORIZED", "invalid or expired code"));
  render(<PairingScreen onPaired={() => {}} />);
  await userEvent.type(screen.getAllByRole("textbox")[0] as HTMLElement, "ZZZZZZ");
  await userEvent.click(screen.getByRole("button", { name: "Appairer" }));
  expect(await screen.findByText("Code invalide ou expiré.")).toBeTruthy();
});

test("too many attempts asks for a new code", async () => {
  outcome = () => Promise.reject(new KiboError("RATE_LIMITED", "too many attempts"));
  render(<PairingScreen onPaired={() => {}} />);
  await userEvent.type(screen.getAllByRole("textbox")[0] as HTMLElement, "ZZZZZZ");
  await userEvent.click(screen.getByRole("button", { name: "Appairer" }));
  expect(await screen.findByText("Trop d'essais : génère un nouveau code dans l'app Kibo.")).toBeTruthy();
});

test("the submit button waits for six characters", async () => {
  render(<PairingScreen onPaired={() => {}} />);
  await userEvent.type(screen.getAllByRole("textbox")[0] as HTMLElement, "K7Q");
  expect((screen.getByRole("button", { name: "Appairer" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Code valable 5 minutes · usage unique")).toBeTruthy();
});
