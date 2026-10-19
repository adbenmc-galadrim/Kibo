import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MERGE_RULE, MINIO } from "../shell/feature/fixture";
import { HoldDialog } from "./HoldDialog";

afterEach(cleanup);

const confirmed: string[] = [];
let cancelled = 0;
const draw = (suggestions: string[] = [MERGE_RULE, MINIO]) => {
  confirmed.length = 0;
  cancelled = 0;
  render(
    <HoldDialog
      ticketKey="SILO-82"
      suggestions={suggestions}
      busy={false}
      error={null}
      onConfirm={(r) => void confirmed.push(r)}
      onCancel={() => {
        cancelled += 1;
      }}
    />,
  );
};
const confirm = () => screen.getByRole("button", { name: "Mettre en attente" });

test("the dialog names the step and refuses an empty reason", () => {
  draw();
  expect(screen.getByRole("dialog", { name: "Mettre SILO-82 en attente" })).toBeTruthy();
  expect(screen.getByText("0/80")).toBeTruthy();
  expect(confirm().hasAttribute("disabled")).toBe(true);
});

test("a reason longer than 80 characters turns the counter red and is refused", async () => {
  draw();
  await userEvent.setup().type(screen.getByLabelText("Raison"), "x".repeat(81));
  const counter = screen.getByText("81/80");
  expect(counter.className).toContain("red");
  expect(confirm().hasAttribute("disabled")).toBe(true);
});

test("a suggestion fills the field and the confirmation sends it", async () => {
  draw();
  const user = userEvent.setup();
  expect(screen.getByText("Raisons déjà employées")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: MINIO }));
  expect((screen.getByLabelText("Raison") as HTMLInputElement).value).toBe(MINIO);
  expect(screen.getByText("37/80")).toBeTruthy();
  await user.click(confirm());
  expect(confirmed).toEqual([MINIO]);
});

test("a typed reason is trimmed and Enter confirms it", async () => {
  draw([]);
  expect(screen.queryByText("Raisons déjà employées")).toBeNull();
  await userEvent.setup().type(screen.getByLabelText("Raison"), "  Accès VPN du client {Enter}");
  expect(confirmed).toEqual(["Accès VPN du client"]);
});

test("Escape cancels", async () => {
  draw();
  await userEvent.setup().keyboard("{Escape}");
  expect(cancelled).toBe(1);
  expect(confirmed).toEqual([]);
});
