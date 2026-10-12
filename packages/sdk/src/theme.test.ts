import { expect, test } from "bun:test";

const css = await Bun.file(new URL("./theme.css", import.meta.url)).text();

test("density tokens follow the 13 px mockups", () => {
  const expected: [string, string][] = [
    ["--text-sm", "0.8125rem"],
    ["--text-sm--line-height", "1.25rem"],
    ["--text-2xs", "0.6875rem"],
    ["--text-2xs--line-height", "1rem"],
    ["--text-3xs", "0.625rem"],
    ["--text-3xs--line-height", "0.875rem"],
    ["--text-md", "0.875rem"],
    ["--text-md--line-height", "1.25rem"],
    ["--text-2xl", "1.375rem"],
    ["--text-2xl--line-height", "1.75rem"],
  ];
  for (const [token, value] of expected) expect(css).toContain(`${token}: ${value};`);
});

test("a spotlit element fades its orange and bounces once, fading only for reduced motion", () => {
  expect(css).toContain("@keyframes kibo-spotlight-fade");
  expect(css).toContain("@keyframes kibo-spotlight-bounce");
  expect(css).toMatch(/\[data-spotlight\] \{\s*animation: kibo-spotlight-fade 1\.5s ease-out forwards;/);
  expect(css).toMatch(
    /\[data-spotlight="bounce"\] \{\s*animation:\s*kibo-spotlight-fade 1\.5s ease-out forwards,\s*kibo-spotlight-bounce 450ms ease-out;/,
  );
  expect(css).toMatch(
    /@media \(prefers-reduced-motion: reduce\) \{\s*\[data-spotlight\],\s*\[data-spotlight="bounce"\] \{\s*animation: kibo-spotlight-fade 1\.5s ease-out forwards;/,
  );
  expect(css).toMatch(/:root \{[^}]*--kibo-spotlight:/);
  expect(css).toMatch(/\.dark \{[^}]*--kibo-spotlight:/);
});
