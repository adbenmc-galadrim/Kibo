import { expect, test } from "bun:test";
import { checksumsFile, macAssets, withDarwinPlatform } from "./release-mac";

const REPO = "adbenmc-galadrim/Kibo";
const BUNDLE = "/k/apps/desktop/src-tauri/target/aarch64-apple-darwin/release/bundle";

test("the mac assets keep the names the CI publishes", () => {
  expect(macAssets("0.35.0-alpha.3", BUNDLE)).toEqual([
    { from: `${BUNDLE}/dmg/Kibo_0.35.0-alpha.3_aarch64.dmg`, name: "Kibo_0.35.0-alpha.3_aarch64.dmg" },
    { from: `${BUNDLE}/macos/Kibo.app.tar.gz`, name: "Kibo_aarch64.app.tar.gz" },
    { from: `${BUNDLE}/macos/Kibo.app.tar.gz.sig`, name: "Kibo_aarch64.app.tar.gz.sig" },
  ]);
});

const linux = {
  signature: "linux-sig",
  url: `https://github.com/${REPO}/releases/download/v0.35.0-alpha.3/Kibo_0.35.0-alpha.3_amd64.AppImage`,
};

test("the darwin entries are added next to the Linux ones, which stay untouched", () => {
  const latest = {
    version: "0.35.0-alpha.3",
    notes: "notes",
    pub_date: "2026-11-23T16:40:00.000Z",
    platforms: { "linux-x86_64": linux },
  };
  const merged = withDarwinPlatform(latest, { repo: REPO, tag: "v0.35.0-alpha.3", signature: "mac-sig" });
  const darwin = {
    signature: "mac-sig",
    url: `https://github.com/${REPO}/releases/download/v0.35.0-alpha.3/Kibo_aarch64.app.tar.gz`,
  };
  expect(merged).toEqual({
    ...latest,
    platforms: { "linux-x86_64": linux, "darwin-aarch64": darwin, "darwin-aarch64-app": darwin },
  });
});

test("a previous darwin entry is replaced", () => {
  const stale = { signature: "old", url: "https://example.invalid/old.tar.gz" };
  const merged = withDarwinPlatform(
    { version: "0.35.0-alpha.3", platforms: { "darwin-aarch64": stale, "darwin-aarch64-app": stale } },
    { repo: REPO, tag: "v0.35.0-alpha.3", signature: "new" },
  );
  expect(merged.platforms["darwin-aarch64"]?.signature).toBe("new");
  expect(merged.platforms["darwin-aarch64-app"]?.signature).toBe("new");
});

test("a manifest of another version is refused", () => {
  expect(() =>
    withDarwinPlatform(
      { version: "0.35.0-alpha.2", platforms: {} },
      { repo: REPO, tag: "v0.35.0-alpha.3", signature: "s" },
    ),
  ).toThrow("latest.json is for 0.35.0-alpha.2, not 0.35.0-alpha.3");
});

test("a manifest without platforms is refused", () => {
  expect(() =>
    withDarwinPlatform({ version: "0.35.0-alpha.3" }, { repo: REPO, tag: "v0.35.0-alpha.3", signature: "s" }),
  ).toThrow("latest.json has no platforms");
});

test("SHA256SUMS has the sha256sum layout, sorted by name, without itself nor install.sh", () => {
  const sums = checksumsFile([
    { name: "b.deb", bytes: new TextEncoder().encode("b") },
    { name: "SHA256SUMS", bytes: new TextEncoder().encode("old") },
    { name: "a.dmg", bytes: new TextEncoder().encode("a") },
    { name: "install.sh", bytes: new TextEncoder().encode("#!/bin/sh") },
  ]);
  expect(sums).toBe(
    [
      "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb  a.dmg",
      "3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d  b.deb",
      "",
    ].join("\n"),
  );
});
