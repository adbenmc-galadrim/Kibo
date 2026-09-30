import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useId, useState } from "react";
import { FolderField } from "./FolderField";

type Pick = (current: string | null) => Promise<string | null>;

function Harness({ pick, canBrowse }: { pick: Pick; canBrowse: boolean }) {
  const id = useId();
  const [value, setValue] = useState("/tmp/a");
  return (
    <>
      <label htmlFor={id}>Dossier</label>
      <FolderField id={id} value={value} onChange={setValue} canBrowse={canBrowse} pick={pick} />
    </>
  );
}
const field = () => screen.getByLabelText("Dossier") as HTMLInputElement;

test("Parcourir… fills the field with the picked folder, starting from the current value", async () => {
  const pick = mock(async (_current: string | null): Promise<string | null> => "/Users/adam/code/kibo");
  render(<Harness pick={pick} canBrowse />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Parcourir…" }));
  expect(pick).toHaveBeenCalledWith("/tmp/a");
  expect(field().value).toBe("/Users/adam/code/kibo");
});

test("a cancelled picker keeps the value and a failing one is explained", async () => {
  const pick = mock(async (_current: string | null): Promise<string | null> => null);
  render(<Harness pick={pick} canBrowse />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Parcourir…" }));
  expect(field().value).toBe("/tmp/a");
  pick.mockImplementationOnce(async () => {
    throw new Error("no dialog");
  });
  const log = console.error;
  console.error = () => {};
  try {
    await user.click(screen.getByRole("button", { name: "Parcourir…" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Impossible d'ouvrir le sélecteur de dossier.",
    );
  } finally {
    console.error = log;
  }
});

test("the field stays editable by hand and there is no browse button outside the desktop app", async () => {
  render(<Harness pick={async () => null} canBrowse={false} />);
  expect(screen.queryByRole("button", { name: "Parcourir…" })).toBeNull();
  await userEvent.setup().type(field(), "/b");
  expect(field().value).toBe("/tmp/a/b");
});
