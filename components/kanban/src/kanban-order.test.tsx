import { expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import { ORDER_KEY } from "./column-order";
import { Component, manifest } from "./index";
import { seed } from "./test-seed";

const setup = () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("screen 126: the whole card is the drag handle, the menu is not; the saved order is applied", async () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam", config: { filter: "all" } });
  const idOf = (key: string) => m.snapshot().tickets.find((t) => t.key === key)?.id ?? key;
  await m.sdk.data.set(ORDER_KEY, { todo: [idOf("KIB-3"), "gone", idOf("KIB-1")] });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const todo = await screen.findByRole("region", { name: "À faire" });
  await waitFor(() =>
    expect(
      within(todo)
        .getAllByRole("article")
        .map((a) => a.getAttribute("data-key")),
    ).toEqual(["KIB-3", "KIB-1", "KIB-2"]),
  );
  const card = within(todo).getByRole("article", { name: /KIB-2/ });
  expect(card.getAttribute("aria-roledescription")).toBe("sortable");
  expect(card.className).toContain("cursor-grab");
  const menu = within(card).getByRole("button", { name: "Actions KIB-2" });
  expect(menu.getAttribute("data-dnd-ignore")).toBe("true");
  expect(within(card).getByRole("button", { name: "Sync" }).getAttribute("data-dnd-ignore")).toBe("true");
  expect(m.used).toContain("data");
});

test("an order written by another member is applied on the next project change", async () => {
  const m = setup();
  const todo = await screen.findByRole("region", { name: "À faire" });
  const keys = () =>
    within(todo)
      .getAllByRole("article")
      .map((a) => a.getAttribute("data-key"));
  await waitFor(() => expect(keys()).toEqual(["KIB-1", "KIB-2"]));
  const idOf = (key: string) => m.snapshot().tickets.find((t) => t.key === key)?.id ?? key;
  m.data.set(ORDER_KEY, { todo: [idOf("KIB-2"), idOf("KIB-1")] });
  m.run({ method: "updateTicket", ticketId: idOf("KIB-5"), title: "Watcher 2" });
  await waitFor(() => expect(keys()).toEqual(["KIB-2", "KIB-1"]));
  expect(m.snapshot().tickets.find((t) => t.key === "KIB-1")?.statusId).toBe("todo");
});

test("a card is not sortable in a read-only project", async () => {
  const m = createMockSdk(manifest, {
    viewer: "adam",
    config: { filter: "all" },
    shared: true,
    seed: (run) => run({ method: "createTicket", title: "Lecture" }),
  });
  m.setAccess("read-only");
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByText("KIB-…");
  await waitFor(() => expect(screen.getByRole("article").getAttribute("aria-disabled")).toBe("true"));
  expect(screen.getByRole("article").className).not.toContain("cursor-grab");
});
