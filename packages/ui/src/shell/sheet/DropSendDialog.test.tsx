import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { DropSendDialog } from "./DropSendDialog";

const renderDrop = (op: "create" | "update") =>
  render(<DropSendDialog open op={op} canUnlink={false} onOpenChange={() => {}} onConfirm={() => {}} />);

test("dropping a creation warns that the issue may already exist", () => {
  renderDrop("create");
  expect(screen.getByRole("alertdialog").textContent).toContain(
    "L'issue a peut-être déjà été créée sur GitHub.",
  );
});

test("dropping an update says the change stays in Kibo only", () => {
  renderDrop("update");
  const text = screen.getByRole("alertdialog").textContent ?? "";
  expect(text).toContain("Cette modification n'est pas envoyée à GitHub");
  expect(text).not.toContain("créée");
});
