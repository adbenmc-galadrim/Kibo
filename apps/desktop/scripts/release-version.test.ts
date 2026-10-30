import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import {
  assertChangelogHasVersion,
  checkReleaseTag,
  readAppVersion,
  type VersionFiles,
  withAppVersion,
} from "./release-version";

const files: VersionFiles = {
  tauriConf:
    '{\n  "productName": "Kibo",\n  "version": "1.0.0",\n  "build": { "frontendDist": "../ui" }\n}\n',
  cargoToml:
    '[package]\nname = "kibo"\nversion = "1.0.0"\nedition = "2021"\n\n[dependencies]\ntauri = { version = "2" }\n',
  cargoLock:
    '[[package]]\nname = "cfg-if"\nversion = "1.0.0"\n\n[[package]]\nname = "kibo"\nversion = "1.0.0"\ndependencies = [\n "tauri",\n]\n\n[[package]]\nname = "tauri"\nversion = "2.11.6"\n',
  packageJson: '{\n  "name": "@kibo/desktop",\n  "version": "1.0.0",\n  "private": true\n}\n',
};

describe("release version", () => {
  test("reads the application version from tauri.conf.json", () => {
    expect(readAppVersion(files.tauriConf)).toBe("1.0.0");
  });

  test("rejects a configuration without a semver version", () => {
    expect(() => readAppVersion('{"version":"1.0"}')).toThrow(KiboError);
    expect(() => readAppVersion("{}")).toThrow(KiboError);
  });

  test("copies a new version into the four files, touching nothing else", () => {
    const next = withAppVersion(files, "1.1.0");
    expect(readAppVersion(next.tauriConf)).toBe("1.1.0");
    expect(next.tauriConf).toContain('"frontendDist": "../ui"');
    expect(next.cargoToml).toBe(files.cargoToml.replace('version = "1.0.0"', 'version = "1.1.0"'));
    expect(next.cargoLock).toContain('name = "kibo"\nversion = "1.1.0"\n');
    expect(next.cargoLock).toContain('name = "cfg-if"\nversion = "1.0.0"\n');
    expect(next.cargoLock).toContain('name = "tauri"\nversion = "2.11.6"\n');
    expect(next.packageJson).toBe(files.packageJson.replace("1.0.0", "1.1.0"));
  });

  test("refuses an invalid version or a lock file without the kibo package", () => {
    expect(() => withAppVersion(files, "1.1")).toThrow(KiboError);
    expect(() =>
      withAppVersion({ ...files, cargoLock: '[[package]]\nname = "tauri"\nversion = "2"\n' }, "1.1.0"),
    ).toThrow(KiboError);
  });

  test("accepts an alpha version in the four files and its tag, refuses any other suffix", () => {
    const next = withAppVersion(files, "0.16.0-alpha.1");
    expect(readAppVersion(next.tauriConf)).toBe("0.16.0-alpha.1");
    expect(next.cargoToml).toContain('version = "0.16.0-alpha.1"');
    expect(next.cargoLock).toContain('name = "kibo"\nversion = "0.16.0-alpha.1"\n');
    expect(next.packageJson).toContain('"version": "0.16.0-alpha.1"');
    expect(() => checkReleaseTag("v0.16.0-alpha.1", "0.16.0-alpha.1")).not.toThrow();
    expect(() => withAppVersion(files, "0.16.0-beta.1")).toThrow(/not a X\.Y\.Z or X\.Y\.Z-alpha\.N version/);
  });

  test("accepts only the tag that matches the application version", () => {
    expect(() => checkReleaseTag("v1.1.0", "1.1.0")).not.toThrow();
    expect(() => checkReleaseTag("v1.2.0", "1.1.0")).toThrow(KiboError);
    expect(() => checkReleaseTag("1.1.0", "1.1.0")).toThrow(KiboError);
  });
});

test("assertChangelogHasVersion accepts a dated heading and refuses a missing one", () => {
  const log = "# Journal\n\n## Non publié\n\n- x\n\n## 1.5.0 — 2026-10-05\n\n- y\n";
  expect(() => assertChangelogHasVersion(log, "1.5.0")).not.toThrow();
  expect(() => assertChangelogHasVersion(log, "1.6.0")).toThrow(/CHANGELOG\.md has no section for 1\.6\.0/);
  expect(() => assertChangelogHasVersion("## 1.5.0\n", "1.5.0")).not.toThrow();
});
