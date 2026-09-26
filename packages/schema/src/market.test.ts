import { describe, expect, test } from "bun:test";
import {
  ComponentId,
  ComponentKind,
  KPKG_MAX_BYTES,
  Kpkg,
  MARKET_FETCH_TIMEOUT_MS,
  MARKET_REFRESH_MS,
  MarketIndex,
} from "./index";

const H = "a".repeat(64);
const manifest = {
  id: "burndown",
  version: "0.3.0",
  kind: "widget",
  title: "Burndown",
  reads: ["ticket"],
  writes: [],
};
const kpkg = {
  format: 1,
  manifest,
  files: [{ path: "ui.tsx", sha256: H, content: "AAAA" }],
  hash: H,
  publisher: { name: "Léa", publicKey: "AAAA" },
  publishedAt: "2026-09-26T10:00:00.000Z",
  signature: "AAAA",
};
const index = {
  format: 1,
  source: { id: "team", name: "Équipe", publicKey: "AAAA" },
  serial: 42,
  generatedAt: "2026-09-26T10:00:00.000Z",
  publishers: [{ publicKey: "AAAA", name: "Léa", verified: true }],
  packages: [
    {
      id: "burndown",
      title: "Burndown",
      description: "Tickets restants par jour",
      kind: "widget",
      versions: [
        {
          version: "0.3.0",
          hash: H,
          publisherKey: "AAAA",
          size: 1234,
          permissions: { reads: ["ticket"], writes: [], data: false, net: [] },
          publishedAt: "2026-09-26T10:00:00.000Z",
          url: "packages/burndown/0.3.0.kpkg",
        },
      ],
    },
  ],
  revoked: [{ hash: "b".repeat(64), reason: "fuite de données" }],
};

describe("component id and kind", () => {
  test("are exported with the manifest rules", () => {
    expect(ComponentId.safeParse("burndown").success).toBe(true);
    expect(ComponentId.safeParse("acme.burndown").success).toBe(true);
    expect(ComponentId.safeParse("Burndown").success).toBe(false);
    expect(ComponentKind.options).toEqual(["widget", "view", "both", "adapter"]);
  });
});

describe("Kpkg", () => {
  test("accepts a well-formed package and applies manifest defaults", () => {
    const parsed = Kpkg.parse(kpkg);
    expect(parsed.manifest.id).toBe("burndown");
    expect(parsed.manifest.net).toEqual([]);
  });
  test("refuses another format, a non-hex hash, an invalid date or no file", () => {
    expect(Kpkg.safeParse({ ...kpkg, format: 2 }).success).toBe(false);
    expect(Kpkg.safeParse({ ...kpkg, hash: "zz" }).success).toBe(false);
    expect(Kpkg.safeParse({ ...kpkg, publishedAt: "hier" }).success).toBe(false);
    expect(Kpkg.safeParse({ ...kpkg, files: [] }).success).toBe(false);
    expect(Kpkg.safeParse({ ...kpkg, publisher: { name: "", publicKey: "AAAA" } }).success).toBe(false);
    expect(Kpkg.safeParse({ ...kpkg, publisher: { name: "x".repeat(65), publicKey: "AAAA" } }).success).toBe(
      false,
    );
  });
});

describe("MarketIndex", () => {
  test("accepts spec H §3.2 and fills permission defaults", () => {
    const parsed = MarketIndex.parse(index);
    expect(parsed.serial).toBe(42);
    expect(parsed.packages[0]?.versions[0]?.permissions.mcp).toEqual([]);
  });
  test("refuses serial 0, another format and malformed versions", () => {
    expect(MarketIndex.safeParse({ ...index, serial: 0 }).success).toBe(false);
    expect(MarketIndex.safeParse({ ...index, format: 2 }).success).toBe(false);
    const bad = structuredClone(index);
    const v = bad.packages[0]?.versions[0];
    if (v) v.version = "1.0";
    expect(MarketIndex.safeParse(bad).success).toBe(false);
  });
});

test("limits", () => {
  expect(KPKG_MAX_BYTES).toBe(2 * 1024 * 1024);
  expect(MARKET_FETCH_TIMEOUT_MS).toBe(30_000);
  expect(MARKET_REFRESH_MS).toBe(6 * 3_600_000);
});
