import { beforeEach, expect, test } from "bun:test";
import { applyWhatsNew, WHATS_NEW_KEY, whatsNewDecision } from "./whats-new";

beforeEach(() => localStorage.clear());

test("first launch stores the version silently, an upgrade shows once, same version does nothing", () => {
  expect(whatsNewDecision(null, "1.5.0")).toBe("store");
  expect(whatsNewDecision("1.4.0", "1.5.0")).toBe("show");
  expect(whatsNewDecision("1.5.0", "1.5.0")).toBe("none");
  expect(whatsNewDecision("1.6.0", "1.5.0")).toBe("none");
});

test("versions compare by numeric triplets, not as text", () => {
  expect(whatsNewDecision("1.9.0", "1.10.0")).toBe("show");
  expect(whatsNewDecision("1.10.0", "1.9.0")).toBe("none");
  expect(whatsNewDecision("1.5.9", "1.5.10")).toBe("show");
});

test("an unreadable stored version counts as older", () => {
  expect(whatsNewDecision("dev", "1.5.0")).toBe("show");
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
