import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { StarterPage } from "@kibo/schema";
import { DOMAINS, PAGES } from "../data/kibo";
import { TICKETS } from "../data/tickets";
import { loadDesired } from "./load";

const REPO = join(import.meta.dir, "..", "..", "..");
const desired = loadDesired(REPO, "/tmp/kibo-folder");

describe("loadDesired", () => {
  test("chains guidelines from workspace to domain, the agents stay in their files", () => {
    const scopes = desired.guidelines.map((g) => g.owner.scope);
    expect(scopes.filter((s) => s === "workspace")).toHaveLength(1);
    expect(scopes.filter((s) => s === "project")).toHaveLength(1);
    expect(scopes.filter((s) => s === "domain")).toHaveLength(DOMAINS.length);
    expect(scopes).toHaveLength(2 + DOMAINS.length);
    expect(desired.guidelines.every((g) => g.content.trim().length > 0)).toBe(true);
  });

  test("points the project and its notes at the given folder", () => {
    expect(desired.project).toMatchObject({ name: "Kibo", key: "KIB", folder: "/tmp/kibo-folder" });
    expect(desired.notesDir).toBe("/tmp/kibo-folder/docs");
  });

  test("knows a version for every component placed on a page", () => {
    for (const page of PAGES)
      for (const i of page.instances)
        expect(desired.manifestVersions.get(i.componentId)).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("data", () => {
  test("ticket titles are unique and their domains exist", () => {
    const titles = TICKETS.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
    const names = new Set(DOMAINS.map((d) => d.name));
    for (const t of TICKETS) if (t.domain !== null) expect(names.has(t.domain)).toBe(true);
  });

  test("pages are valid starter pages", () => {
    for (const p of PAGES)
      expect(
        StarterPage.safeParse({
          title: p.title,
          kind: p.kind,
          components: p.instances.map((i) => ({ id: i.componentId, config: i.config })),
        }).success,
      ).toBe(true);
  });
});
