import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type GrantedPermissions, NO_PERMISSIONS } from "@kibo/schema";
import { readDraftManifest } from "./draft-files";
import { declareMissing, grantedFromKeys, unionGranted } from "./draft-permissions";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function draftDir(manifest: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), "kibo-perm-"));
  roots.push(dir);
  writeFileSync(join(dir, "kibo.component.json"), JSON.stringify(manifest));
  return dir;
}

const base = {
  id: "burndown",
  version: "0.1.0",
  kind: "widget",
  title: "Burndown",
  reads: ["ticket"],
  writes: [],
};

test("grantedFromKeys reads the devkit notation", () => {
  expect(
    grantedFromKeys([
      "read:ticket",
      "write:ticket",
      "data",
      "net:https://api.github.com/graphql?x=1",
      "mcp:figma/get_file",
    ]),
  ).toEqual({
    reads: ["ticket"],
    writes: ["ticket"],
    data: true,
    net: ["api.github.com/graphql"],
    secrets: [],
    mcp: ["figma/get_file"],
  });
  expect(grantedFromKeys(["net:api.github.com", "net:https://api.github.com"]).net).toEqual([
    "api.github.com",
  ]);
});

test("grantedFromKeys never declares a secret nor an unknown key", () => {
  expect(() => grantedFromKeys(["secret:github@api.github.com"])).toThrow("VALIDATION_FAILED");
  expect(() => grantedFromKeys(["read:bogus"])).toThrow("VALIDATION_FAILED");
  expect(() => grantedFromKeys(["write:createProject"])).toThrow("VALIDATION_FAILED");
  expect(() => grantedFromKeys(["net:http://localhost:3000"])).toThrow("VALIDATION_FAILED");
});

test("unionGranted keeps both sides once and the declared secrets", () => {
  const secrets: GrantedPermissions["secrets"] = [{ name: "github", hosts: ["api.github.com"] }];
  expect(
    unionGranted(
      { ...NO_PERMISSIONS, reads: ["ticket"], secrets },
      { ...NO_PERMISSIONS, reads: ["ticket", "status"], data: true },
    ),
  ).toEqual({ ...NO_PERMISSIONS, reads: ["ticket", "status"], data: true, secrets });
});

test("declareMissing adds declarable permissions and refuses anything else", () => {
  const dir = draftDir(base);
  expect(declareMissing(dir, [])).toBe(false);
  expect(declareMissing(dir, ["read:ticket", "secret:github@api.github.com"])).toBe(false);
  expect(readDraftManifest(dir).reads).toEqual(["ticket"]);
  expect(declareMissing(dir, ["read:status", "net:https://api.github.com/graphql"])).toBe(true);
  expect(readDraftManifest(dir)).toMatchObject({
    reads: ["ticket", "status"],
    net: ["api.github.com/graphql"],
  });
});
