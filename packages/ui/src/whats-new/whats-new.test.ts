import { beforeEach, expect, test } from "bun:test";
import { applyWhatsNew, WHATS_NEW_KEY, whatsNewDecision } from "./whats-new";

beforeEach(() => localStorage.clear());

test("what's new shows whenever the installed version differs from the one last seen", () => {
  expect(whatsNewDecision(null, "0.16.0-alpha.1")).toBe("store");
  expect(whatsNewDecision("1.6.0", "0.16.0-alpha.1")).toBe("show");
  expect(whatsNewDecision("0.16.0-alpha.1", "0.16.0-alpha.2")).toBe("show");
  expect(whatsNewDecision("0.16.0-alpha.2", "0.16.0-alpha.2")).toBe("none");
  expect(whatsNewDecision("garbage", "0.16.0-alpha.2")).toBe("show");
});

test("a first launch only stores the installed version", () => {
  let shown = 0;
  applyWhatsNew("1.5.0", () => shown++);
  expect(localStorage.getItem(WHATS_NEW_KEY)).toBe("1.5.0");
  expect(shown).toBe(0);
});

test("an upgrade opens the dialog and leaves the key for the dialog to write", () => {
  localStorage.setItem(WHATS_NEW_KEY, "1.4.0");
  let shown = 0;
  applyWhatsNew("1.5.0", () => shown++);
  expect(shown).toBe(1);
  expect(localStorage.getItem(WHATS_NEW_KEY)).toBe("1.4.0");
});

test("the key is the documented localStorage key", () => {
  expect(WHATS_NEW_KEY).toBe("kibo.whatsNew.seenVersion");
});
