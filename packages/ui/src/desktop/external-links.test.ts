import { afterAll, afterEach, beforeAll, expect, mock, test } from "bun:test";
import { externalLinkOf, installExternalLinks } from "./external-links";

const DAEMON = "http://127.0.0.1:4800";
const happy = Reflect.get(window, "happyDOM");
const setURL = (url: string) => Reflect.apply(Reflect.get(Object(happy), "setURL"), happy, [url]);
const before = location.href;

beforeAll(() => setURL(`${DAEMON}/`));
afterAll(() => setURL(before));

afterEach(() => {
  document.body.replaceChildren();
});

const anchor = (href: string, target: string | null = "_blank") => {
  const a = document.createElement("a");
  a.href = href;
  if (target) a.target = target;
  const inner = document.createElement("span");
  a.appendChild(inner);
  document.body.appendChild(a);
  return { a, inner };
};

test("a link is outgoing when it leaves the daemon origin or opens a new tab", () => {
  expect(externalLinkOf(anchor("https://github.com/kibo/pull/4").inner, DAEMON)).toEqual({
    url: "https://github.com/kibo/pull/4",
  });
  expect(externalLinkOf(anchor("https://kibo.dev/", null).a, DAEMON)).toEqual({ url: "https://kibo.dev/" });
  for (const href of ["http://example.org/", "javascript:alert(1)", "file:///etc/passwd", "mailto:a@b.c"]) {
    expect(externalLinkOf(anchor(href).a, DAEMON)).toEqual({ url: null });
    expect(externalLinkOf(anchor(href, null).a, DAEMON)).toEqual({ url: null });
  }
  expect(externalLinkOf(anchor("javascript:alert(1)", "_BLANK").a, DAEMON)).toEqual({ url: null });
  expect(externalLinkOf(anchor("/x").a, DAEMON)).toEqual({ url: null });
  expect(externalLinkOf(anchor("/x", null).a, DAEMON)).toBeNull();
  expect(externalLinkOf(anchor("#/p/p1/1", null).a, DAEMON)).toBeNull();
  expect(externalLinkOf(anchor("javascript:alert(1)", null).a, "null")).toEqual({ url: null });
  expect(externalLinkOf(document.createElement("div"), DAEMON)).toBeNull();
  expect(externalLinkOf(null, DAEMON)).toBeNull();
});

const neutralised = (target: Element, type: "click" | "auxclick" = "click", button = 0): boolean => {
  let prevented = false;
  const observe = (e: Event) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  window.addEventListener(type, observe);
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button }));
  window.removeEventListener(type, observe);
  return prevented;
};

test("a click on an outgoing https link is intercepted and sent to the opener; other schemes are neutralised", () => {
  const open = mock((_url: string) => Promise.resolve());
  const off = installExternalLinks(document, open);
  const https = anchor("https://kibo.dev/docs");
  expect(neutralised(https.inner)).toBe(true);
  expect(open).toHaveBeenCalledWith("https://kibo.dev/docs");
  for (const href of ["javascript:alert(1)", "file:///etc/passwd", "mailto:a@b.c", "http://example.org/"]) {
    expect(neutralised(anchor(href).a)).toBe(true);
  }
  expect(open).toHaveBeenCalledTimes(1);
  off();
  expect(neutralised(https.inner)).toBe(false);
  expect(open).toHaveBeenCalledTimes(1);
});

test("a link without target that leaves the daemon origin never navigates the webview", () => {
  const open = mock((_url: string) => Promise.resolve());
  const off = installExternalLinks(document, open);
  expect(neutralised(anchor("https://kibo.dev/same", null).a)).toBe(true);
  expect(open).toHaveBeenCalledWith("https://kibo.dev/same");
  for (const href of ["mailto:a@b.c", "javascript:alert(1)"]) {
    expect(neutralised(anchor(href, null).a)).toBe(true);
  }
  expect(neutralised(anchor("javascript:alert(1)", "_BLANK").a)).toBe(true);
  expect(neutralised(anchor("data:text/html,x").a)).toBe(true);
  expect(neutralised(anchor(`blob:${DAEMON}/0b8f`).a)).toBe(true);
  expect(open).toHaveBeenCalledTimes(1);
  off();
});

test("a same-origin link without a new tab is left to the router", () => {
  const open = mock((_url: string) => Promise.resolve());
  const off = installExternalLinks(document, open);
  expect(neutralised(anchor("#/p/p1/1", null).a)).toBe(false);
  expect(neutralised(anchor("/x", null).a)).toBe(false);
  expect(open).not.toHaveBeenCalled();
  off();
});

test("a middle click on an outgoing https link goes to the opener", () => {
  const open = mock((_url: string) => Promise.resolve());
  const off = installExternalLinks(document, open);
  expect(neutralised(anchor("https://kibo.dev/docs", null).inner, "auxclick", 1)).toBe(true);
  expect(open).toHaveBeenCalledWith("https://kibo.dev/docs");
  expect(neutralised(anchor("mailto:a@b.c", null).a, "auxclick", 1)).toBe(true);
  expect(neutralised(anchor("https://kibo.dev/docs").a, "auxclick", 2)).toBe(false);
  expect(neutralised(anchor("#/p/p1/1", null).a, "auxclick", 1)).toBe(false);
  expect(open).toHaveBeenCalledTimes(1);
  off();
  expect(neutralised(anchor("https://kibo.dev/docs").a, "auxclick", 1)).toBe(false);
});

test("a failed opener is reported, never thrown", async () => {
  const errors: unknown[] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  try {
    const off = installExternalLinks(document, () => Promise.reject(new Error("no browser")));
    expect(neutralised(anchor("https://kibo.dev/").a)).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(errors).toHaveLength(1);
    off();
  } finally {
    console.error = log;
  }
});
