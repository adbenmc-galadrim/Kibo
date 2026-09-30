import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconField } from "./IconField";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const show = (p: Partial<Parameters<typeof IconField>[0]> = {}) => {
  const onPick = mock((_icon: { mime: string; data: string }) => {});
  const onRemove = mock(() => {});
  render(
    <IconField
      label="Kibo"
      currentUrl={null}
      pending={null}
      removed={false}
      onPick={onPick}
      onRemove={onRemove}
      {...p}
    />,
  );
  return { onPick, onRemove, user: userEvent.setup({ applyAccept: false }) };
};

test("choosing a png hands the encoded icon to the parent", async () => {
  const { onPick, user } = show();
  expect(screen.getByRole("img", { name: "Aucune image" })).toBeTruthy();
  await user.upload(
    screen.getByLabelText("Choisir une image…"),
    new File([PNG], "logo.png", { type: "image/png" }),
  );
  expect(onPick).toHaveBeenCalledWith({ mime: "image/png", data: "iVBORw0KGgo=" });
});

test("a refused file is explained and nothing is handed over", async () => {
  const { onPick, user } = show();
  await user.upload(
    screen.getByLabelText("Choisir une image…"),
    new File(["<svg/>"], "a.svg", { type: "image/svg+xml" }),
  );
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Format non pris en charge : PNG, JPEG ou WebP.",
  );
  expect(onPick).not.toHaveBeenCalled();
});

test("the preview shows the pending image first, then the current one, and Retirer asks the parent", async () => {
  const { onRemove, user } = show({
    currentUrl: "/icons/project/p1?v=abc",
    pending: { mime: "image/png", data: "iVBORw0KGgo=" },
  });
  expect(screen.getByRole("img", { name: "Image · Kibo" }).getAttribute("src")).toBe(
    "data:image/png;base64,iVBORw0KGgo=",
  );
  await user.click(screen.getByRole("button", { name: "Retirer l'image" }));
  expect(onRemove).toHaveBeenCalledTimes(1);
});

test("a removed image shows the empty tile even when the server still has one", () => {
  show({ currentUrl: "/icons/project/p1?v=abc", removed: true });
  expect(screen.getByRole("img", { name: "Aucune image" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retirer l'image" })).toBeNull();
});
