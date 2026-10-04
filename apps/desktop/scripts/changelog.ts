import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { changelogSection } from "@kibo/schema";

const CHANGELOG = resolve(import.meta.dir, "../../../CHANGELOG.md");

const [command, version] = process.argv.slice(2);

if (command === "section" && version) {
  const body = changelogSection(readFileSync(CHANGELOG, "utf8"), version);
  if (body === null) {
    console.error(`CHANGELOG.md has no section for ${version}`);
    process.exit(1);
  }
  console.log(body);
} else {
  console.error("usage: changelog.ts section X.Y.Z");
  process.exit(2);
}
