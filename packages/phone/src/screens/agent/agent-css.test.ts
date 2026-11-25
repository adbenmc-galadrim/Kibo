import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./agent.css", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.css", import.meta.url), "utf8");
const rule = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing rule ${selector}`);
  return css.slice(start, css.indexOf("}", start));
};

test("the agent stylesheet is loaded by the phone entry", () => {
  expect(index).toContain('@import "./screens/agent/agent.css";');
});

test("buttons of the agent screen are 44 pt high and checkboxes get a 44 pt touch zone", () => {
  expect(rule('.phone-agent [data-slot="button"]')).toContain("min-height: 44px");
  expect(rule('.phone-agent [data-slot="checkbox"]::after')).toContain("inset: -13px");
});

test("the compose box follows the mockup: 44 pt high, radius 22, round 32 pt send in brandBtn", () => {
  const box = rule('.phone-agent-compose div:has(> [data-slot="textarea"])');
  expect(box).toContain("min-height: 44px");
  expect(box).toContain("border-radius: 22px");
  const send = rule('.phone-agent-compose [data-slot="textarea"] + button');
  expect(send).toContain("width: 32px");
  expect(send).toContain("border-radius: 9999px");
  expect(send).toContain("background: var(--tracking-brand-btn)");
  expect(rule('.phone-agent-compose [data-slot="textarea"] + button::after')).toContain("inset: -6px");
});
