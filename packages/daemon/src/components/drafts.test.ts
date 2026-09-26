import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspaceDoc, putRegistryVersion } from "@kibo/core";
import { hashSources } from "@kibo/devkit";
import { NO_PERMISSIONS } from "@kibo/schema";
import { draftsDir, listDrafts } from "./drafts";

const homes: string[] = [];
afterAll(() => {
  for (const h of homes) rmSync(h, { recursive: true, force: true });
});

async function draft(home: string, id: string, version: string, stamp: "ok" | "failed" | "stale" | null) {
  const dir = join(draftsDir(home), id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "kibo.component.json"),
    JSON.stringify({ id, version, kind: "widget", title: id.toUpperCase(), reads: [], writes: [] }),
  );
  writeFileSync(join(dir, "ui.tsx"), "export function Component() { return null; }");
  const hash = await hashSources(dir);
  if (stamp) {
    mkdirSync(join(dir, ".kibo"));
    writeFileSync(
      join(dir, ".kibo", "validation.json"),
      JSON.stringify({
        hash: stamp === "stale" ? "0".repeat(64) : hash,
        version,
        ok: stamp !== "failed",
        at: 1,
      }),
    );
  }
  return hash;
}

test("drafts are listed with their validation state and hide what is already published", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-drafts-"));
  homes.push(home);
  const ws = createWorkspaceDoc();
  await draft(home, "burndown", "0.1.0", "ok");
  await draft(home, "pending", "0.1.0", "stale");
  await draft(home, "broken", "0.1.0", "failed");
  const publishedHash = await draft(home, "done", "1.0.0", "ok");
  const pr = await draft(home, "pr-queue", "0.4.0", "ok");
  mkdirSync(join(draftsDir(home), "not-a-component"));
  putRegistryVersion(ws, "done", "DONE", {
    version: "1.0.0",
    hash: publishedHash,
    origin: "user",
    trust: null,
    approvedHash: null,
    granted: NO_PERMISSIONS,
    publishedAt: 1,
    autoUpdate: false,
    source: null,
    revoked: null,
  });
  putRegistryVersion(ws, "pr-queue", "PR", {
    version: "0.3.0",
    hash: "a".repeat(64),
    origin: "user",
    trust: null,
    approvedHash: null,
    granted: NO_PERMISSIONS,
    publishedAt: 1,
    autoUpdate: false,
    source: null,
    revoked: null,
  });
  expect(await listDrafts(home, ws)).toEqual([
    {
      id: "broken",
      title: "BROKEN",
      version: "0.1.0",
      hash: expect.any(String),
      validated: false,
      publishedVersion: null,
    },
    {
      id: "burndown",
      title: "BURNDOWN",
      version: "0.1.0",
      hash: expect.any(String),
      validated: true,
      publishedVersion: null,
    },
    {
      id: "pending",
      title: "PENDING",
      version: "0.1.0",
      hash: expect.any(String),
      validated: false,
      publishedVersion: null,
    },
    {
      id: "pr-queue",
      title: "PR-QUEUE",
      version: "0.4.0",
      hash: pr,
      validated: true,
      publishedVersion: "0.3.0",
    },
  ]);
});

test("no drafts folder means no drafts", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-drafts-"));
  homes.push(home);
  expect(await listDrafts(home, createWorkspaceDoc())).toEqual([]);
});

test("symbolic links and folders named after another id are not drafts", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-drafts-"));
  const outside = mkdtempSync(join(tmpdir(), "kibo-outside-"));
  homes.push(home, outside);
  await draft(outside, "escape", "0.1.0", "ok");
  await draft(home, "real", "0.1.0", "ok");
  symlinkSync(join(draftsDir(outside), "escape"), join(draftsDir(home), "escape"));
  await draft(home, "renamed", "0.1.0", "ok");
  renameSync(join(draftsDir(home), "renamed"), join(draftsDir(home), "other"));
  expect((await listDrafts(home, createWorkspaceDoc())).map((d) => d.id)).toEqual(["real"]);
});
