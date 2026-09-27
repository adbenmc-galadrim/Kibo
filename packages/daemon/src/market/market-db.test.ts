import { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "bun:test";
import { type MarketDb, type MarketSourceRow, openMarketDb } from "./market-db";

const row: MarketSourceRow = {
  id: "equipe",
  url: "https://m.example/",
  name: "Équipe",
  publicKey: "key",
  fingerprint: "f",
  lastSerial: null,
  lastFetchedAt: null,
  enabled: true,
  lastError: null,
};
const bytes = (text: string) => new TextEncoder().encode(text);
let db: MarketDb;

beforeEach(() => {
  db = openMarketDb(new Database(":memory:"));
});

test("a second source with the same id is not stored", () => {
  expect(db.addSource(row)).toBe(true);
  expect(db.addSource({ ...row, url: "https://autre.example/" })).toBe(false);
  expect(db.source("equipe")?.url).toBe("https://m.example/");
});

test("an older index never replaces a newer one", () => {
  db.addSource(row);
  expect(
    db.setFetched("equipe", { serial: 6, bytes: bytes("six"), sig: "s6", at: 1, publicKey: "key" }),
  ).toBe(true);
  expect(
    db.setFetched("equipe", { serial: 5, bytes: bytes("cinq"), sig: "s5", at: 2, publicKey: "key" }),
  ).toBe(false);
  expect(db.source("equipe")?.lastSerial).toBe(6);
  expect(db.cachedIndex("equipe")?.sig).toBe("s6");
  expect(
    db.setFetched("equipe", { serial: 6, bytes: bytes("six"), sig: "s6b", at: 3, publicKey: "key" }),
  ).toBe(true);
});

test("an index fetched for another key of the source is not stored", () => {
  db.addSource(row);
  expect(
    db.setFetched("equipe", { serial: 9, bytes: bytes("old"), sig: "old", at: 1, publicKey: "old-key" }),
  ).toBe(false);
  expect(db.source("equipe")?.lastSerial).toBeNull();
  expect(db.cachedIndex("equipe")).toBeNull();
});

test("removing a source keeps its publisher pins", () => {
  db.addSource(row);
  db.setPin("equipe", "burndown", "pub", 1);
  db.removeSource("equipe");
  expect(db.pin("equipe", "burndown")).toBe("pub");
});
