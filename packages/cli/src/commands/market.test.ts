import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Kpkg } from "@kibo/schema";
import { decodeKpkg, verifyIndex } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { z } from "zod";
import { type MarketCliDeps, type MarketDaemon, runMarketCommand } from "./market";

let dir: string;
const out: string[] = [];
const err: string[] = [];

function daemonReturning(pkg: Kpkg) {
  const exportKpkg = mock(async (_input: Parameters<MarketDaemon["exportKpkg"]>[0]) => pkg);
  return { exportKpkg, client: { exportKpkg } };
}

const deps = (client: MarketDaemon | null = null): MarketCliDeps => ({
  daemon: async () => client,
  out: (l) => out.push(l),
  err: (l) => err.push(l),
  now: () => new Date("2026-09-26T10:00:00Z"),
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kibo-cli-market-"));
  out.length = 0;
  err.length = 0;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("keygen writes a private key file readable by its owner only and never overwrites it", async () => {
  const file = join(dir, "source.key");
  expect(await runMarketCommand(["keygen"], { out: file }, deps())).toBe(0);
  expect(statSync(file).mode & 0o777).toBe(0o600);
  expect(out.join("\n")).toContain("SHA256");
  const before = readFileSync(file, "utf8");
  await expect(runMarketCommand(["keygen"], { out: file }, deps())).rejects.toThrow("INVALID_INPUT");
  expect(readFileSync(file, "utf8")).toBe(before);
});

test("pack asks the daemon for a signed package and writes it", async () => {
  const made = await makeTestPackage({ id: "burndown", version: "0.1.0" });
  const { exportKpkg, client } = daemonReturning(made.pkg);
  const file = join(dir, "burndown-0.1.0.kpkg");
  expect(
    await runMarketCommand(["pack", "burndown@0.1.0"], { out: file, publisher: "Adam" }, deps(client)),
  ).toBe(0);
  expect(exportKpkg).toHaveBeenCalledWith({
    id: "burndown",
    version: "0.1.0",
    publisherName: "Adam",
  });
  expect(decodeKpkg(new Uint8Array(readFileSync(file))).hash).toBe(made.pkg.hash);
});

test("pack stops when the daemon cannot be reached", async () => {
  expect(await runMarketCommand(["pack", "burndown@0.1.0"], { out: join(dir, "x.kpkg") }, deps())).toBe(1);
  expect(existsSync(join(dir, "x.kpkg"))).toBe(false);
});

test("index signs the folder with the key written by keygen", async () => {
  const key = join(dir, "source.key");
  await runMarketCommand(["keygen"], { out: key }, deps());
  const site = join(dir, "site");
  mkdirSync(join(site, "packages", "burndown"), { recursive: true });
  const made = await makeTestPackage({ id: "burndown", version: "0.1.0" });
  writeFileSync(join(site, "packages", "burndown", "0.1.0.kpkg"), made.bytes);
  const flags = { dir: site, key, id: "perso", name: "Perso", verify: made.publisher.keys.publicKey };
  expect(await runMarketCommand(["index"], flags, deps())).toBe(0);
  expect(out.at(-1)).toBe("Index n° 1 signé (1 paquet)");
  const { publicKey } = z.object({ publicKey: z.string() }).parse(JSON.parse(readFileSync(key, "utf8")));
  const index = await verifyIndex({
    bytes: new Uint8Array(readFileSync(join(site, "index.json"))),
    sig: readFileSync(join(site, "index.json.sig"), "utf8").trim(),
    expectedKey: publicKey,
    lastSerial: null,
  });
  expect(index.publishers).toEqual([
    { publicKey: made.publisher.keys.publicKey, name: made.publisher.name, verified: true },
  ]);
});

test("index requires its options", async () => {
  await expect(runMarketCommand(["index"], { dir }, deps())).rejects.toThrow("INVALID_INPUT");
});

test("an unknown sub-command prints the usage and fails", async () => {
  expect(await runMarketCommand(["nope"], {}, deps())).toBe(2);
  expect(err.join("\n")).toContain("kibo market keygen");
});
