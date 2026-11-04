import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

afterEach(() => {
  cleanup();
  for (const meta of Array.from(document.head.querySelectorAll('meta[property="csp-nonce"]'))) meta.remove();
});

const openSelect = () =>
  render(
    <Select open value="a">
      <SelectTrigger aria-label="Ticket">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">SILO-1</SelectItem>
        <SelectItem value="b">SILO-2</SelectItem>
      </SelectContent>
    </Select>,
  );

const viewportStyles = () =>
  Array.from(document.querySelectorAll("style")).filter((s) => s.textContent?.includes("radix-select-viewport"));

test("an open Select gives its viewport style the page nonce", async () => {
  const meta = document.createElement("meta");
  meta.setAttribute("property", "csp-nonce");
  meta.setAttribute("content", "c2VsZWN0LW5vbmNlLTEyMzQ=");
  document.head.append(meta);
  openSelect();
  await screen.findByRole("listbox");
  const styles = viewportStyles();
  expect(styles.length).toBe(1);
  expect(styles[0]?.getAttribute("nonce")).toBe("c2VsZWN0LW5vbmNlLTEyMzQ=");
});

test("without a page nonce, as on the desktop, the style has no nonce", async () => {
  openSelect();
  await screen.findByRole("listbox");
  const styles = viewportStyles();
  expect(styles.length).toBe(1);
  expect(styles[0]?.hasAttribute("nonce")).toBe(false);
});
