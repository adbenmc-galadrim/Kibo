import { afterEach, expect, mock, test } from "bun:test";
import { externalLinkOf, installExternalLinks } from "./external-links";

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

test("only https links opened in a new tab are external", () => {
  expect(externalLinkOf(anchor("https://github.com/kibo/pull/4").inner)).toBe(
    "https://github.com/kibo/pull/4",
  );
  expect(externalLinkOf(anchor("http://example.org/").a)).toBeNull();
  expect(externalLinkOf(anchor("javascript:alert(1)").a)).toBeNull();
  expect(externalLinkOf(anchor("file:///etc/passwd").a)).toBeNull();
  expect(externalLinkOf(anchor("mailto:a@b.c").a)).toBeNull();
  expect(externalLinkOf(anchor("https://kibo.dev/", null).a)).toBeNull();
  expect(externalLinkOf(document.createElement("div"))).toBeNull();
  expect(externalLinkOf(null)).toBeNull();
});

const neutralised = (target: Element): boolean => {
  let prevented = false;
  const observe = (e: Event) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  window.addEventListener("click", observe);
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  window.removeEventListener("click", observe);
  return prevented;
};

test("a click on an https link is intercepted and sent to the opener; other schemes are neutralised", () => {
  const open = mock((_url: string) => Promise.resolve());
  const off = installExternalLinks(document, open);
  const https = anchor("https://kibo.dev/docs");
  expect(neutralised(https.inner)).toBe(true);
  expect(open).toHaveBeenCalledWith("https://kibo.dev/docs");
  for (const href of ["javascript:alert(1)", "file:///etc/passwd", "mailto:a@b.c", "http://example.org/"]) {
    expect(neutralised(anchor(href).a)).toBe(true);
  }
  expect(open).toHaveBeenCalledTimes(1);
  expect(neutralised(anchor("https://kibo.dev/same", null).a)).toBe(false);
  off();
  expect(neutralised(https.inner)).toBe(false);
  expect(open).toHaveBeenCalledTimes(1);
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
