import { expect, test } from "bun:test";
import { deliveryMenuActions } from "./deliver-state";

const withClipboard = async (work: () => Promise<void>): Promise<string[]> => {
  const written: string[] = [];
  const clipboard = { writeText: (text: string) => Promise.resolve(void written.push(text)) };
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
  try {
    await work();
  } finally {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
  return written;
};

const menuOf = (statusId: "todo" | "done" = "todo", key: string | null = "SILO-33") => ({
  entries: deliveryMenuActions({
    ticket: { key, statusId, startable: true, waitingOn: [] },
    sdk: { toast: () => undefined },
  }),
});

test("the menu copies the full-delivery command", async () => {
  const { entries } = menuOf();
  expect(entries.map((e) => e.label)).toEqual(["Copier /full-delivery SILO-33"]);
  const written = await withClipboard(async () => {
    entries[0]?.onSelect();
    await Promise.resolve();
  });
  expect(written).toEqual(["/full-delivery SILO-33"]);
});

test("no copy for a ticket without key", () => {
  expect(menuOf("todo", null).entries).toEqual([]);
  expect(menuOf("done", null).entries).toEqual([]);
});

test("a done ticket offers a touch-up: copy /update-delivery", async () => {
  const hidden = menuOf("done", "SILO-21");
  expect(hidden.entries.map((e) => e.label)).toEqual(["Copier /update-delivery SILO-21"]);
  const written = await withClipboard(async () => {
    hidden.entries[0]?.onSelect();
    await Promise.resolve();
  });
  expect(written).toEqual(["/update-delivery SILO-21"]);
});

const sdkMenu = (statusId: "todo" | "done", waitingOn: string[]) => {
  const toasts: string[] = [];
  const entries = deliveryMenuActions({
    ticket: { key: "SILO-33", statusId, startable: waitingOn.length === 0, waitingOn },
    sdk: { toast: (message) => void toasts.push(message) },
  });
  return { entries, toasts };
};

test("the Copier /full-delivery entry copies the command and says Copié", async () => {
  const { entries, toasts } = sdkMenu("todo", ["SILO-30"]);
  expect(entries.map((e) => e.label)).toEqual(["Copier /full-delivery SILO-33"]);
  const written = await withClipboard(async () => {
    entries[0]?.onSelect();
    await Promise.resolve();
  });
  expect(written).toEqual(["/full-delivery SILO-33"]);
  await Promise.resolve();
  expect(toasts).toEqual(["Copié · attend SILO-30"]);
});

test("the touch-up entry copies /update-delivery and says Copié", async () => {
  const { entries, toasts } = sdkMenu("done", []);
  const written = await withClipboard(async () => {
    entries[0]?.onSelect();
    await Promise.resolve();
  });
  expect(written).toEqual(["/update-delivery SILO-33"]);
  await Promise.resolve();
  expect(toasts).toEqual(["Copié"]);
});
