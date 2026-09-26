import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ComponentSummary,
  NO_PERMISSIONS,
  type PublishResult,
  type RegistryVersion,
} from "@kibo/schema";
import { createPublishLock } from "../components/publish-lock";
import { catalogPort, differPort } from "./live-ports";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-live-"));
  roots.push(d);
  return d;
};

const stored: RegistryVersion = {
  version: "0.1.0",
  hash: "a".repeat(64),
  origin: "ai",
  trust: "sandboxed",
  approvedHash: "a".repeat(64),
  granted: NO_PERMISSIONS,
  publishedAt: 1,
  autoUpdate: false,
  source: null,
  revoked: null,
};

function fakeComponents(list: ComponentSummary[] = []) {
  const calls: string[] = [];
  const result: PublishResult = { version: stored, needsApproval: true, updated: [], failed: [] };
  return {
    calls,
    components: {
      registry: {
        list: () => list,
        approve: async (id: string, version: string, hash: string, trust: string) => {
          calls.push(`approve ${id}@${version} ${hash.slice(0, 1)} ${trust}`);
          return stored;
        },
      },
      publisher: {
        publish: async (id: string, strategy: string, opts?: { origin: string }) => {
          calls.push(`publish ${id} ${strategy} ${opts?.origin}`);
          return result;
        },
      },
      publishLock: createPublishLock(),
      usageChanged: () => calls.push("usage"),
    },
  };
}

describe("catalogPort", () => {
  test("an id is taken when built in, installed or present in the sources", () => {
    const home = tmp();
    mkdirSync(join(home, "components", "src", "velocity"), { recursive: true });
    const installed: ComponentSummary = { id: "burndown", title: "Burndown", builtin: false, versions: [] };
    const catalog = catalogPort({ home, components: fakeComponents([installed]).components });
    expect(["kanban", "github-issues", "mcp-source", "burndown", "velocity"].map(catalog.isTaken)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(catalog.isTaken("sprint")).toBe(false);
    expect(catalog.sourceDir("sprint")).toBe(join(home, "components", "src", "sprint"));
  });

  test("publish and approve go through the components service and refresh the usages", async () => {
    const f = fakeComponents();
    const catalog = catalogPort({ home: tmp(), components: f.components });
    await catalog.publish({ id: "burndown", strategy: "update-all", origin: "ai" });
    await catalog.approve({ id: "burndown", version: "0.1.0", hash: "a".repeat(64), trust: "trusted" });
    expect(f.calls).toEqual([
      "publish burndown update-all ai",
      "usage",
      "approve burndown@0.1.0 a trusted",
      "usage",
    ]);
  });
});

describe("differPort", () => {
  test("diffs two files of a draft, read only", async () => {
    const dir = tmp();
    writeFileSync(join(dir, "a.tsx"), "one\ntwo\n");
    writeFileSync(join(dir, "b.tsx"), "one\nthree\n");
    const differ = differPort(process.env, dir);
    const changed = await differ({ path: "ui.tsx", before: join(dir, "a.tsx"), after: join(dir, "b.tsx") });
    expect(changed).toMatchObject({ path: "ui.tsx", hunkStaging: false, additions: 1, deletions: 1 });
    const added = await differ({ path: "x.test.tsx", before: null, after: join(dir, "b.tsx") });
    expect(added).toMatchObject({ path: "x.test.tsx", additions: 2, deletions: 0 });
  });
});
