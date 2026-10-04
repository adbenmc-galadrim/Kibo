import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  assertChangelogHasVersion,
  checkReleaseTag,
  readAppVersion,
  type VersionFiles,
  withAppVersion,
} from "@kibo/devkit";

const desktop = resolve(import.meta.dir, "..");
const CHANGELOG = resolve(desktop, "../../CHANGELOG.md");
const PATHS: Record<keyof VersionFiles, string> = {
  tauriConf: join(desktop, "src-tauri/tauri.conf.json"),
  cargoToml: join(desktop, "src-tauri/Cargo.toml"),
  cargoLock: join(desktop, "src-tauri/Cargo.lock"),
  packageJson: join(desktop, "package.json"),
};

function readFiles(): VersionFiles {
  return {
    tauriConf: readFileSync(PATHS.tauriConf, "utf8"),
    cargoToml: readFileSync(PATHS.cargoToml, "utf8"),
    cargoLock: readFileSync(PATHS.cargoLock, "utf8"),
    packageJson: readFileSync(PATHS.packageJson, "utf8"),
  };
}

const [command, argument] = process.argv.slice(2);
const files = readFiles();
const current = readAppVersion(files.tauriConf);

if (command === "get") {
  console.log(current);
} else if (command === "set" && argument) {
  const next = withAppVersion(files, argument);
  for (const key of Object.keys(PATHS) as (keyof VersionFiles)[]) writeFileSync(PATHS[key], next[key]);
  console.log(`version ${current} -> ${argument}`);
} else if (command === "check" && argument) {
  checkReleaseTag(argument, current);
  assertChangelogHasVersion(readFileSync(CHANGELOG, "utf8"), current);
  console.log(`tag ${argument} matches version ${current}`);
} else {
  console.error("usage: version.ts get | set X.Y.Z | check vX.Y.Z");
  process.exit(2);
}
