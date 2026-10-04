import { expect, test } from "bun:test";
import { ASSET_URL_TTL_MS } from "@kibo/schema";
import { createFileTokens } from "./tokens";

test("tokens are random, bound, expiring and bounded per instance", () => {
  const now = { t: 0 };
  let n = 0;
  const tokens = createFileTokens({ now: () => now.t, random: () => `${n++}`.padStart(64, "0") });
  const grant = { projectId: "p", name: "robot.glb", mime: "model/gltf-binary" as const };
  const a = tokens.mint("i1", grant);
  expect(a.expiresAt).toBe(ASSET_URL_TTL_MS);
  expect(tokens.lookup(a.token)).toEqual(grant);
  now.t = ASSET_URL_TTL_MS + 1;
  expect(tokens.lookup(a.token)).toBeNull();
  for (let i = 0; i < 65; i++) tokens.mint("i2", grant);
  expect(tokens.lookup("1".padStart(64, "0"))).toBeNull();
  expect(tokens.lookup(`${65}`.padStart(64, "0"))).toEqual(grant);
  expect(tokens.lookup("zz")).toBeNull();
});

test("default tokens are 32 random bytes in hex", () => {
  const tokens = createFileTokens();
  const grant = { projectId: "p", name: "a.png", mime: "image/png" as const };
  const a = tokens.mint("i", grant).token;
  const b = tokens.mint("i", grant).token;
  expect(a).toMatch(/^[0-9a-f]{64}$/);
  expect(a).not.toBe(b);
});
