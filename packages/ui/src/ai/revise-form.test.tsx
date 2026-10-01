import { expect, mock, test } from "bun:test";
import type { DraftAttachmentInput } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviseForm } from "./ReviseForm";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const label = "Ce qu'il faut changer";
const send = "Envoyer à l'agent";

type Sent = { feedback: string; attachments: DraftAttachmentInput[] };

function mount(busy = false) {
  const sent: Sent[] = [];
  const onCancel = mock(() => {});
  render(<ReviseForm busy={busy} remaining={7} onSubmit={(input) => sent.push(input)} onCancel={onCancel} />);
  return { sent, onCancel };
}

test("under 5 characters the send button stays disabled", async () => {
  mount();
  const user = userEvent.setup();
  const button = screen.getByRole("button", { name: send });
  expect(button.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText(label), "  ab ");
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("5 caractères minimum.")).toBeTruthy();
  await user.type(screen.getByLabelText(label), "cde");
  expect(button.hasAttribute("disabled")).toBe(false);
});

test("busy disables the form", async () => {
  mount(true);
  await userEvent.setup().type(screen.getByLabelText(label), "Mets le total en gros");
  expect(screen.getByRole("button", { name: send }).hasAttribute("disabled")).toBe(true);
});

test("the remaining revisions are counted", () => {
  mount();
  expect(screen.getByText("7 révisions restantes")).toBeTruthy();
});

test("the feedback is sent trimmed with the attached images", async () => {
  const { sent } = mount();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(label), " Mets le total en gros ");
  await user.upload(
    screen.getByLabelText("Ajouter des images"),
    new File([new Uint8Array(PNG)], "Capture d'écran 1.png", { type: "image/png" }),
  );
  expect(await screen.findByRole("img", { name: "Capture-d-ecran-1.png" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: send }));
  expect(sent).toEqual([
    {
      feedback: "Mets le total en gros",
      attachments: [{ name: "Capture-d-ecran-1.png", mime: "image/png", data: expect.any(String) }],
    },
  ]);
});

test("Échap and Annuler cancel", async () => {
  const { onCancel } = mount();
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(label));
  await user.keyboard("{Escape}");
  expect(onCancel).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Annuler" }));
  expect(onCancel).toHaveBeenCalledTimes(2);
});
