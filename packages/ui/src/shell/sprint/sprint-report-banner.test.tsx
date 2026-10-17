import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SprintReportBanner } from "./SprintReportBanner";

const proposal = { batchId: "b7", seq: 7, moves: [{ actionId: 1, shortKey: "F5", to: "S43" }] };

test("the banner asks to move F5 and applies that action only, keeping the rest of the batch", async () => {
  const decide = mock(async (_: unknown) => {});
  render(<SprintReportBanner proposal={proposal} editable decide={decide} />);
  expect(screen.getByText("Fin de sprint : reporter F5 en S43 ?")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Valider" }));
  expect(decide).toHaveBeenCalledWith({ batchId: "b7", decision: "apply", actionIds: [1], keepRest: true });
});

test("refusing rejects the moves only, after a confirmation", async () => {
  const decide = mock(async (_: unknown) => {});
  render(<SprintReportBanner proposal={proposal} editable decide={decide} />);
  await userEvent.click(screen.getByRole("button", { name: "Refuser" }));
  expect(decide).not.toHaveBeenCalled();
  expect(screen.getByText("Refuser le report proposé par le lot n° 7 ?")).toBeTruthy();
  const buttons = screen.getAllByRole("button", { name: "Refuser" });
  const confirm = buttons.at(-1);
  if (!confirm) throw new Error("no confirm button");
  await userEvent.click(confirm);
  expect(decide).toHaveBeenCalledWith({ batchId: "b7", decision: "reject", actionIds: [1], keepRest: true });
});

test("no proposal, no banner; read only, no buttons", () => {
  const { container } = render(<SprintReportBanner proposal={null} editable decide={async () => {}} />);
  expect(container.textContent).toBe("");
  render(<SprintReportBanner proposal={proposal} editable={false} decide={async () => {}} />);
  expect(screen.queryByRole("button", { name: "Valider" })).toBeNull();
});
