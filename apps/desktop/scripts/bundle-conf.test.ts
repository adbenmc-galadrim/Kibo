import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const conf = JSON.parse(readFileSync(join(import.meta.dir, "../src-tauri/tauri.conf.json"), "utf8"));

test("macOS is signed ad hoc, without hardened runtime, Apple identity or entitlements", () => {
  expect(conf.bundle.macOS.signingIdentity).toBe("-");
  expect(conf.bundle.macOS.hardenedRuntime).toBe(false);
  expect(conf.bundle.macOS.minimumSystemVersion).toBe("12.0");
  expect(conf.bundle.macOS.entitlements).toBeUndefined();
  expect(JSON.stringify(conf)).not.toMatch(/APPLE_|notar/i);
});

test("the disk image has a background and the two usual positions", () => {
  expect(conf.bundle.macOS.dmg).toEqual({
    background: "../dmg/background.png",
    windowSize: { width: 660, height: 400 },
    appPosition: { x: 180, y: 170 },
    applicationFolderPosition: { x: 480, y: 170 },
  });
});

test("bundle metadata describes the application", () => {
  expect(conf.bundle.shortDescription).toBe("Centre de contrôle local pour tes projets de code");
  expect(conf.bundle.longDescription.split("\n")).toHaveLength(3);
  expect(conf.bundle.category).toBe("DeveloperTool");
  expect(conf.bundle.copyright).toBe("© 2026 Adam Ben Mchichi");
  expect(conf.bundle.publisher).toBe("Kibo");
  expect(conf.bundle.homepage).toBe("https://github.com/adbenmc-galadrim/Kibo");
  expect(conf.bundle.license).toBe("MIT");
  expect(conf.bundle.licenseFile).toBeUndefined();
});

test("Linux gets the desktop template and the four icon sizes", () => {
  expect(conf.bundle.linux.deb.desktopTemplate).toBe("linux/kibo.desktop.hbs");
  expect(conf.bundle.icon).toEqual([
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/256x256.png",
    "icons/icon.png",
    "icons/icon.icns",
    "icons/icon.ico",
  ]);
  const desktop = readFileSync(join(import.meta.dir, "../src-tauri/linux/kibo.desktop.hbs"), "utf8");
  expect(desktop).toContain("Categories=Development;ProjectManagement;");
  expect(desktop).toContain("Keywords=kanban;tickets;agents;claude;");
  expect(desktop).toContain("StartupWMClass={{exec}}");
  expect(desktop).toContain("Terminal=false");
  expect(desktop).toMatch(/^Comment=.+/m);
});

test("three external binaries ship with the app: the daemon, the hook and the demo agent", () => {
  expect(conf.bundle.externalBin).toEqual([
    "binaries/kibo-daemon",
    "binaries/kibo-hook",
    "binaries/kibo-demo-agent",
  ]);
});

test("bundles explicit targets without msi, which refuses an alpha version", () => {
  expect(conf.bundle.targets).toEqual(["app", "dmg", "deb", "rpm", "appimage"]);
  expect(conf.bundle.createUpdaterArtifacts).toBe(true);
});

test("the updater asks the alpha channel first, then the latest release", () => {
  expect(conf.plugins.updater.endpoints).toEqual([
    "https://github.com/adbenmc-galadrim/Kibo/releases/download/alpha/latest.json",
    "https://github.com/adbenmc-galadrim/Kibo/releases/latest/download/latest.json",
  ]);
});
