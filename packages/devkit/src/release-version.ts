import { changelogVersions, KiboError } from "@kibo/schema";

export type VersionFiles = { tauriConf: string; cargoToml: string; cargoLock: string; packageJson: string };

const SEMVER = /^\d+\.\d+\.\d+$/;
const JSON_VERSION = /"version":\s*"([^"]*)"/;
const TOML_VERSION = /^version = "[^"]*"$/m;
const LOCK_KIBO_VERSION = /(\[\[package\]\]\nname = "kibo"\nversion = )"[^"]*"/;

function assertSemver(version: string, where: string): void {
  if (!SEMVER.test(version))
    throw new KiboError("INVALID_INPUT", `${where}: "${version}" is not a X.Y.Z version`);
}

export function readAppVersion(tauriConf: string): string {
  const version = JSON_VERSION.exec(tauriConf)?.[1];
  if (version === undefined) throw new KiboError("INVALID_INPUT", "tauri.conf.json has no version");
  assertSemver(version, "tauri.conf.json");
  return version;
}

function replaceOnce(text: string, pattern: RegExp, replacement: string, where: string): string {
  if (!pattern.test(text)) throw new KiboError("INVALID_INPUT", `${where}: version not found`);
  return text.replace(pattern, replacement);
}

export function withAppVersion(files: VersionFiles, version: string): VersionFiles {
  assertSemver(version, "requested version");
  return {
    tauriConf: replaceOnce(files.tauriConf, JSON_VERSION, `"version": "${version}"`, "tauri.conf.json"),
    cargoToml: replaceOnce(files.cargoToml, TOML_VERSION, `version = "${version}"`, "Cargo.toml"),
    cargoLock: replaceOnce(files.cargoLock, LOCK_KIBO_VERSION, `$1"${version}"`, "Cargo.lock"),
    packageJson: replaceOnce(files.packageJson, JSON_VERSION, `"version": "${version}"`, "package.json"),
  };
}

export function checkReleaseTag(tag: string, version: string): void {
  if (tag !== `v${version}`)
    throw new KiboError("INVALID_INPUT", `tag ${tag} does not match the application version ${version}`);
}

export function assertChangelogHasVersion(markdown: string, version: string): void {
  if (!changelogVersions(markdown).includes(version))
    throw new KiboError("INVALID_INPUT", `CHANGELOG.md has no section for ${version}`);
}
