import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";

const props = (onConfirm: () => Promise<void>, onOpenChange = mock((_o: boolean) => {})) => ({
  open: true,
  onOpenChange,
  title: "Supprimer la page Kanban ?",
  description: "Ses 2 sous-pages disparaîtront.",
  confirmLabel: "Supprimer",
  cancelLabel: "Annuler",
  onConfirm,
});

test("confirming awaits the action then closes", async () => {
  const onOpenChange = mock((_o: boolean) => {});
  let resolve: () => void = () => {};
  const onConfirm = mock(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  render(<ConfirmDialog {...props(onConfirm, onOpenChange)} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Supprimer" }));
  expect((screen.getByRole("button", { name: "Supprimer" }) as HTMLButtonElement).disabled).toBe(true);
  expect(onOpenChange).not.toHaveBeenCalled();
  resolve();
  await screen.findByRole("button", { name: "Supprimer" });
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

test("a failed action keeps the dialog open and shows the error", async () => {
  const onOpenChange = mock((_o: boolean) => {});
  render(<ConfirmDialog {...props(() => Promise.reject(new Error("git refused")), onOpenChange)} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Supprimer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("git refused");
  expect(onOpenChange).not.toHaveBeenCalledWith(false);
  expect((screen.getByRole("button", { name: "Supprimer" }) as HTMLButtonElement).disabled).toBe(false);
});

test("cancel closes without calling the action", async () => {
  const onOpenChange = mock((_o: boolean) => {});
  const onConfirm = mock(() => Promise.resolve());
  render(<ConfirmDialog {...props(onConfirm, onOpenChange)} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Annuler" }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});
