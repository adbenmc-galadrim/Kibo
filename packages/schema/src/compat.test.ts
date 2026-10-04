import { expect, test } from "bun:test";
import { Instance, RegistryVersion, type TrustPreview } from "./index";

test("a v0.6 registry entry parses with source and revoked set to null", () => {
  const v06 = {
    version: "0.3.0",
    hash: "c".repeat(64),
    origin: "user",
    trust: "sandboxed",
    approvedHash: "c".repeat(64),
    granted: { reads: ["ticket"], writes: [], data: false, net: [] },
    publishedAt: 1,
  };
  const parsed = RegistryVersion.parse(v06);
  expect(parsed.autoUpdate).toBe(false);
  expect(parsed.source).toBeNull();
  expect(parsed.revoked).toBeNull();
});

test("a marketplace entry keeps its source and revocation", () => {
  const parsed = RegistryVersion.parse({
    version: "0.3.0",
    hash: "c".repeat(64),
    origin: "marketplace",
    trust: null,
    approvedHash: null,
    granted: { reads: [], writes: [], data: false, net: [] },
    publishedAt: 1,
    autoUpdate: false,
    source: { sourceId: "team", publisherKey: "AAAA" },
    revoked: { reason: "fuite de données", at: 5 },
  });
  expect(parsed.source).toEqual({ sourceId: "team", publisherKey: "AAAA" });
  expect(parsed.revoked?.reason).toBe("fuite de données");
});

test("a v0.6 instance parses with componentHash null", () => {
  const parsed = Instance.parse({
    id: "i1",
    pageId: "pg1",
    component: "kanban@1.0.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
  });
  expect(parsed.componentHash).toBeNull();
});

test("componentHash must be a sha256 when present", () => {
  const base = {
    id: "i1",
    pageId: "pg1",
    component: "burndown@0.3.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
  };
  expect(Instance.safeParse({ ...base, componentHash: "d".repeat(64) }).success).toBe(true);
  expect(Instance.safeParse({ ...base, componentHash: "nope" }).success).toBe(false);
});

test("a trust preview is a trust target plus market details", () => {
  const preview: TrustPreview = {
    id: "burndown",
    title: "Burndown",
    version: "0.3.0",
    hash: "c".repeat(64),
    origin: "marketplace",
    permissions: {
      reads: ["ticket"],
      writes: [],
      data: false,
      net: [],
      secrets: [],
      mcp: [],
      capabilities: [],
    },
    market: { publisherName: "Léa", verified: true, sourceName: "Équipe", newPublisher: true },
  };
  expect(preview.market?.newPublisher).toBe(true);
});
