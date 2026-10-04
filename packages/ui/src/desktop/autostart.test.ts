import { expect, test } from "bun:test";
import { createTauriAutostart } from "./autostart";

test("the port forwards to the plugin lazily and never throws synchronously", async () => {
  const calls: string[] = [];
  const port = createTauriAutostart(() =>
    Promise.resolve({
      isEnabled: async () => {
        calls.push("is");
        return true;
      },
      enable: async () => {
        calls.push("on");
      },
      disable: async () => {
        calls.push("off");
      },
    }),
  );
  expect(calls).toEqual([]);
  expect(await port.isEnabled()).toBe(true);
  await port.enable();
  await port.disable();
  expect(calls).toEqual(["is", "on", "off"]);
});
