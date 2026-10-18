import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

test("dialogs and sheets veil the light theme in white, as the mockups P6 and P8 draw it", () => {
  expect(css).toContain(
    ':root:not(.dark) :is([data-slot="dialog-overlay"], [data-slot="sheet-overlay"]) {\n  background-color: rgb(255 255 255 / 0.6);\n}',
  );
});
