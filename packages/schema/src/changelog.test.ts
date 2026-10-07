import { expect, test } from "bun:test";
import { changelogSection, changelogVersions } from "./changelog";

const LOG = `# Journal des versions

## Non publié

- en cours

## 1.5.0 — 2026-10-05

- Installation : image disque, paquets Linux.
- Didacticiel.

## 1.4.0 — 2026-10-04

- Composants plus riches.
`;

test("changelogSection returns the body of one version without its heading", () => {
  expect(changelogSection(LOG, "1.5.0")).toBe(
    "- Installation : image disque, paquets Linux.\n- Didacticiel.",
  );
  expect(changelogSection(LOG, "1.4.0")).toBe("- Composants plus riches.");
  expect(changelogSection(LOG, "1.3.0")).toBeNull();
  expect(changelogSection(LOG, "1.5")).toBeNull();
});

test("changelogVersions lists published versions, newest first", () => {
  expect(changelogVersions(LOG)).toEqual(["1.5.0", "1.4.0"]);
  expect(changelogVersions("# rien")).toEqual([]);
});

test("an alpha section is found by its full version", () => {
  const log =
    "## Non publié\n\n## 0.16.0-alpha.1 — 2026-10-07\n\n- Versions alpha.\n\n## 1.6.0 — 2026-10-05\n\n- Avant.\n";
  expect(changelogSection(log, "0.16.0-alpha.1")).toBe("- Versions alpha.");
  expect(changelogVersions(log)).toEqual(["0.16.0-alpha.1", "1.6.0"]);
});
