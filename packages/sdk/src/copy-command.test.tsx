import { afterEach, expect, test } from "bun:test";
import type { StartReason } from "@kibo/schema";
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

test("a ticket blocked by a question warns which question holds it", async () => {
  const { written, toasts, sdk } = recorder();
  await copyDeliveryCommand(sdk, { key: "EMIS-51", startable: true, waitingOn: [], question: "Q14" });
  expect(written).toEqual(["/full-delivery EMIS-51"]);
  expect(toasts).toEqual(["Copié · bloqué par Q14"]);
  const both = recorder();
  await copyDeliveryCommand(both.sdk, {
    key: "EMIS-51",
    startable: false,
    waitingOn: ["EMIS-33"],
    question: "Q14",
  });
  expect(both.toasts).toEqual(["Copié · bloqué par Q14 · attend EMIS-33"]);
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

test("every copy says why the ticket cannot start yet, from its start reason", async () => {
  const cases: [StartReason, string][] = [
    [{ kind: "sprint", code: "S43" }, "Copié · sprint S43"],
    [{ kind: "limit", limit: 2, count: 2 }, "Copié · limite 2/2 atteinte"],
    [{ kind: "dependency", keys: ["PFD-3"] }, "Copié · attend PFD-3"],
    [{ kind: "question", label: "Q14" }, "Copié · bloqué par Q14"],
    [{ kind: "unplanned" }, "Copié · sans sprint"],
  ];
  for (const [startReason, toast] of cases) {
    const { toasts, sdk } = recorder();
    await copyDeliveryCommand(sdk, { key: "PFD-4", startable: false, waitingOn: [], startReason });
    expect(toasts).toEqual([toast]);
  }
});

test("the start reason replaces the former warnings, a started ticket keeps its question", async () => {
  const waiting = recorder();
  await copyDeliveryCommand(waiting.sdk, {
    key: "PFD-4",
    startable: false,
    waitingOn: ["PFD-3"],
    question: "Q14",
    startReason: { kind: "dependency", keys: ["PFD-3", "PFD-2"] },
  });
  expect(waiting.toasts).toEqual(["Copié · attend PFD-3, PFD-2"]);
  const started = recorder();
  await copyDeliveryCommand(started.sdk, {
    key: "PFD-2",
    startable: false,
    waitingOn: [],
    question: "Q1",
    startReason: { kind: "status" },
  });
  expect(started.toasts).toEqual(["Copié · bloqué par Q1"]);
  const ready = recorder();
  await copyDeliveryCommand(ready.sdk, { key: "PFD-1", startable: true, waitingOn: [], startReason: null });
  expect(ready.toasts).toEqual(["Copié"]);
});
