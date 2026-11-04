import { expect, test } from "bun:test";
import { contrast } from "./color-math";
import { themeById } from "./palette-presets";
import { paletteTokens } from "./palette-tokens";

const prune = themeById("prune");

test("a role drives both token families", () => {
  const tokens = paletteTokens(prune.roles);
  expect(tokens["--background"]).toBe(prune.roles.bg);
  expect(tokens["--tracking-bg"]).toBe(prune.roles.bg);
  expect(tokens["--muted-foreground"]).toBe(prune.roles.dim);
  expect(tokens["--tracking-dim"]).toBe(prune.roles.dim);
  expect(tokens["--brand"]).toBe(prune.roles.agent);
  expect(tokens["--primary"]).toBe(prune.roles.accent);
});

test("derived tokens stay readable whatever the agent color", () => {
  const roles = { ...prune.roles, agent: "#3B0764" };
  const tokens = paletteTokens(roles);
  expect(contrast(tokens["--tracking-brand-text"] ?? "", roles.hover)).toBeGreaterThanOrEqual(4.5);
  expect(contrast("#FFFFFF", tokens["--tracking-brand-btn"] ?? "")).toBeGreaterThanOrEqual(4.5);
  expect(contrast(tokens["--input"] ?? "", roles.bg)).toBeGreaterThanOrEqual(3);
});

test("the number on a status fill reads on every fill", () => {
  const { roles } = prune;
  const tokens = paletteTokens(roles);
  for (const fill of [roles.blue, roles.purple, roles.red])
    expect(contrast(tokens["--tracking-on-fill"] ?? "", fill)).toBeGreaterThanOrEqual(4.5);
});
