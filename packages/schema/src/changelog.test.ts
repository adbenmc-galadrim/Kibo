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
