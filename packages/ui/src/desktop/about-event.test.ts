import { expect, spyOn, test } from "bun:test";
import { ABOUT_EVENT, createAboutEvent, type ListenApi } from "./about-event";

function fakeListen() {
  const subscribed: string[] = [];
  const handlers: (() => void)[] = [];
  const api: ListenApi = {
    listen: async (event, handler) => {
      subscribed.push(event);
      handlers.push(handler);
      return () => {
        throw new Error("unlisten is not allowed by the capability");
      };
    },
  };
  return {
    api,
    subscribed,
    fire: () => {
      for (const h of handlers) h();
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

test("the native about event is listened to once for the life of the window", async () => {
  const fake = fakeListen();
  const listen = createAboutEvent(
    () => Promise.resolve(fake.api),
    () => true,
  );
  let first = 0;
  let second = 0;
  listen(() => first++);
  listen(() => second++);
  await flush();
  expect(fake.subscribed).toEqual([ABOUT_EVENT]);
  fake.fire();
  expect([first, second]).toEqual([0, 1]);
});

test("outside the desktop shell nothing is listened to", async () => {
  let loads = 0;
  const listen = createAboutEvent(
    () => {
      loads++;
      return Promise.resolve(fakeListen().api);
    },
    () => false,
  );
  listen(() => {});
  await flush();
  expect(loads).toBe(0);
});

test("a failed import is logged without throwing", async () => {
  const error = spyOn(console, "error").mockImplementation(() => {});
  const listen = createAboutEvent(
    () => Promise.reject(new Error("no tauri")),
    () => true,
  );
  expect(() => listen(() => {})).not.toThrow();
  await flush();
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});

test("the event name is the one emitted by the native menu", () => {
  expect(ABOUT_EVENT).toBe("kibo:about");
});
