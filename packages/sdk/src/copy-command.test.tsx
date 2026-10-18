import { afterEach, expect, test } from "bun:test";
import { copyDeliveryCommand } from "./copy-command";

const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");

afterEach(() => {
  if (original) Object.defineProperty(navigator, "clipboard", original);
  else Reflect.deleteProperty(navigator, "clipboard");
});

function clipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

function recorder() {
  const written: string[] = [];
  clipboard((text) => Promise.resolve(void written.push(text)));
  const toasts: string[] = [];
  return { written, toasts, sdk: { toast: (message: string) => void toasts.push(message) } };
}

test("a startable ticket copies its full-delivery command and says Copié", async () => {
  const { written, toasts, sdk } = recorder();
  await copyDeliveryCommand(sdk, { key: "EMIS-45", startable: true, waitingOn: [] });
  expect(written).toEqual(["/full-delivery EMIS-45"]);
  expect(toasts).toEqual(["Copié"]);
});

test("a ticket that cannot start warns which tickets it waits for", async () => {
  const one = recorder();
  await copyDeliveryCommand(one.sdk, { key: "EMIS-45", startable: false, waitingOn: ["EMIS-33"] });
  expect(one.written).toEqual(["/full-delivery EMIS-45"]);
  expect(one.toasts).toEqual(["Copié · attend EMIS-33"]);
  const two = recorder();
  await copyDeliveryCommand(two.sdk, {
    key: "EMIS-45",
    startable: false,
    waitingOn: ["EMIS-33", "EMIS-34"],
  });
  expect(two.toasts).toEqual(["Copié · attend EMIS-33, EMIS-34"]);
});

test("a refused clipboard says Copie impossible without throwing", async () => {
  const toasts: string[] = [];
  clipboard(() => Promise.reject(new Error("denied")));
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    await copyDeliveryCommand(
      { toast: (m) => void toasts.push(m) },
      { key: "EMIS-45", startable: true, waitingOn: [] },
    );
  } finally {
    console.warn = warn;
  }
  expect(toasts).toEqual(["Copie impossible"]);
});

test("a missing clipboard says Copie impossible without throwing", async () => {
  const toasts: string[] = [];
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    await copyDeliveryCommand(
      { toast: (m) => void toasts.push(m) },
      { key: "EMIS-45", startable: true, waitingOn: [] },
    );
  } finally {
    console.warn = warn;
  }
  expect(toasts).toEqual(["Copie impossible"]);
});

test("a ticket without key cannot be copied", async () => {
  const { written, toasts, sdk } = recorder();
  await copyDeliveryCommand(sdk, { key: null, startable: true, waitingOn: [] });
  expect(written).toEqual([]);
  expect(toasts).toEqual(["Copie impossible"]);
});
