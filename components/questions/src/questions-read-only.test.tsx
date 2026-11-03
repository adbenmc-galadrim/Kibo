import { afterEach, expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fr } from "./fr";
import { Component, manifest } from "./index";
import { openRow, Q14, seedSilo } from "./question-fixtures.test-helper";

afterEach(cleanup);

const MAC_OFF = "Mac éteint";
const disabled = (el: HTMLElement) =>
  el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";

const mountReadOnly = () => {
  const m = createMockSdk(manifest, {
    seed: seedSilo,
    surface: "view",
    client: "Silo SA",
    writeBlock: MAC_OFF,
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("read-only, the header greys the new question and the export with the reason", async () => {
  mountReadOnly();
  await screen.findByRole("article", { name: Q14 });
  for (const button of [
    screen.getByRole("button", { name: fr.newQuestion }),
    ...screen.getAllByRole("button", { name: /^Exporter/ }),
  ]) {
    expect(disabled(button)).toBe(true);
    expect(button.title).toBe(MAC_OFF);
  }
});

test("read-only, the answer form and the recipient are greyed with the reason", async () => {
  mountReadOnly();
  const row = await openRow(Q14);
  expect(disabled(within(row).getByRole("textbox", { name: fr.yourAnswer }))).toBe(true);
  const reply = within(row).getByRole("button", { name: fr.reply });
  expect(disabled(reply)).toBe(true);
  expect(reply.className).not.toContain("disabled:opacity-100");
  expect(disabled(within(row).getByRole("button", { name: fr.paste.open }))).toBe(true);
  const recipient = within(row).getByRole("button", { name: /^Destinataire/ });
  expect(disabled(recipient)).toBe(true);
  expect(recipient.title).toBe(MAC_OFF);
});

test("read-only, the row menu greys every write", async () => {
  mountReadOnly();
  const user = userEvent.setup();
  const row = await openRow(Q14);
  await user.click(within(row).getByRole("button", { name: /^Actions de/ }));
  const items = screen.getAllByRole("menuitem");
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.textContent).toContain(MAC_OFF);
  }
});

test("read-only, the filters stay usable and the add recipient entry is greyed", async () => {
  mountReadOnly();
  const user = userEvent.setup();
  await screen.findByRole("article", { name: Q14 });
  await user.click(screen.getByRole("button", { name: fr.recipients.shownAll }));
  const add = await screen.findByRole("menuitem", { name: new RegExp(fr.recipients.addLabel) });
  expect(add.getAttribute("aria-disabled")).toBe("true");
  const radios = screen.getAllByRole("menuitemradio");
  for (const radio of radios) expect(radio.getAttribute("aria-disabled")).not.toBe("true");
});
