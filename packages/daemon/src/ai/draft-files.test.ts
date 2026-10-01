import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { hashSources } from "@kibo/devkit";
import { ComponentManifest, KiboError, NO_PERMISSIONS } from "@kibo/schema";
import { attachmentPaths, writeAttachments } from "./draft-attachments";
import {
  agentFiles,
  draftPaths,
  isAgentFile,
  prepareDraft,
  readDraftManifest,
  removeDraft,
  verifyAndRestore,
  writeDraftManifest,
  writePermissions,
} from "./draft-files";
import { cleanHomes, home, kiboFiles, prepared, scaffold } from "./testing/draft-fixture";

cleanHomes();

const IMAGE = {
  name: "a.png",
  mime: "image/png",
  data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]).toString("base64"),
} as const;

test("draftPaths places the draft and its base under components/drafts", () => {
  expect(draftPaths("/h", "d1")).toEqual({
    dir: "/h/components/drafts/d1",
    baseDir: "/h/components/drafts/d1.base",
    attachmentsDir: "/h/components/drafts/d1.attachments",
  });
});

test("isAgentFile accepts only root ui.tsx, server.ts with a backend and *.test.tsx", () => {
  expect(isAgentFile("ui.tsx", false)).toBe(true);
  expect(isAgentFile("burndown.test.tsx", false)).toBe(true);
  expect(isAgentFile("server.ts", false)).toBe(false);
  expect(isAgentFile("server.ts", true)).toBe(true);
  expect(isAgentFile("sub/ui.tsx", true)).toBe(false);
  expect(isAgentFile("../ui.tsx", true)).toBe(false);
  expect(isAgentFile("kibo.component.json", true)).toBe(false);
  expect(isAgentFile("migrations.ts", true)).toBe(false);
  expect(isAgentFile("CLAUDE.md", true)).toBe(false);
  expect(isAgentFile(".test.tsx", true)).toBe(false);
  expect(isAgentFile("a.b.test.tsx", true)).toBe(false);
});

describe("prepareDraft", () => {
  test("creates the draft and its base with private permissions", async () => {
    const paths = await prepared();
    expect(readFileSync(join(paths.dir, "CLAUDE.md"), "utf8")).toBe("# Règles\n");
    expect(existsSync(join(paths.baseDir, ".claude/skills/kibo-component/SKILL.md"))).toBe(true);
    expect(statSync(paths.dir).mode & 0o777).toBe(0o700);
    expect(statSync(paths.baseDir).mode & 0o777).toBe(0o700);
  });
  test("refuses an existing draft folder", async () => {
    const paths = await prepared();
    const error = await prepareDraft({ paths, fill: scaffold, kiboFiles }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(KiboError);
    expect(error).toMatchObject({ code: "CONFLICT" });
    expect(readFileSync(join(paths.dir, "ui.tsx"), "utf8")).toContain("=> null");
  });
  test("refuses a leftover base folder", async () => {
    const paths = draftPaths(home(), "d1");
    mkdirSync(paths.baseDir, { recursive: true });
    await expect(prepareDraft({ paths, fill: scaffold, kiboFiles })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(existsSync(paths.dir)).toBe(false);
  });
  test("refuses a leftover images folder", async () => {
    const paths = draftPaths(home(), "d1");
    mkdirSync(paths.attachmentsDir, { recursive: true });
    await expect(prepareDraft({ paths, fill: scaffold, kiboFiles })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(existsSync(paths.dir)).toBe(false);
  });
  test("removes the partial draft when filling fails", async () => {
    const paths = draftPaths(home(), "d1");
    const fill = async () => {
      throw new Error("scaffold failed");
    };
    await expect(prepareDraft({ paths, fill, kiboFiles })).rejects.toThrow("scaffold failed");
    expect(existsSync(paths.dir) || existsSync(paths.baseDir)).toBe(false);
  });
  test("refuses a Kibo file path escaping the draft", async () => {
    const paths = draftPaths(home(), "d1");
    const escaping = { "../evil.md": "x" };
    await expect(prepareDraft({ paths, fill: scaffold, kiboFiles: escaping })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(existsSync(join(dirname(paths.dir), "evil.md"))).toBe(false);
    expect(existsSync(paths.dir)).toBe(false);
  });
});

test("agentFiles lists agent files of the draft and of its base", async () => {
  const paths = await prepared();
  writeFileSync(join(paths.dir, "burndown.test.tsx"), "x");
  expect(agentFiles(paths, false)).toEqual(["burndown.test.tsx", "component.test.tsx", "ui.tsx"]);
});

test("the images live beside the draft: unseen by the restore and the agent files, removed with it", async () => {
  const paths = await prepared();
  const before = await hashSources(paths.dir);
  const images = writeAttachments(paths.attachmentsDir, [IMAGE, { ...IMAGE, name: "b.png" }], []);
  expect(readdirSync(paths.dir)).not.toContain("1-a.png");
  expect(readdirSync(paths.baseDir)).not.toContain("1-a.png");
  expect(await hashSources(paths.dir)).toBe(before);
  expect(verifyAndRestore(paths, false)).toEqual([]);
  expect(agentFiles(paths, false)).toEqual(["component.test.tsx", "ui.tsx"]);
  expect(attachmentPaths(paths.attachmentsDir, images).every((p) => existsSync(p))).toBe(true);
  removeDraft(paths);
  expect(existsSync(paths.attachmentsDir) || existsSync(paths.dir) || existsSync(paths.baseDir)).toBe(false);
});

test("writePermissions rewrites the inferable permission fields and keeps declared secrets", async () => {
  const paths = await prepared();
  writePermissions(paths.dir, { ...NO_PERMISSIONS, reads: ["ticket", "status"], data: true, mcp: ["figma"] });
  expect(readDraftManifest(paths.dir)).toMatchObject({
    id: "burndown",
    reads: ["ticket", "status"],
    data: true,
    mcp: ["figma"],
    secrets: [],
  });
});

test("writePermissions never writes granted secrets", async () => {
  const paths = await prepared();
  writePermissions(paths.dir, {
    ...NO_PERMISSIONS,
    secrets: [{ name: "github", hosts: ["api.github.com"] }],
  });
  expect(readDraftManifest(paths.dir).secrets).toEqual([]);
});

describe("manifest access", () => {
  const linkedManifest = async () => {
    const paths = await prepared();
    const victim = join(home(), "victim.json");
    writeFileSync(victim, readFileSync(join(paths.dir, "kibo.component.json")));
    rmSync(join(paths.dir, "kibo.component.json"));
    symlinkSync(victim, join(paths.dir, "kibo.component.json"));
    return { paths, victim };
  };
  test("refuses a manifest replaced by a symbolic link", async () => {
    const { paths, victim } = await linkedManifest();
    const before = readFileSync(victim, "utf8");
    const corrupt = expect.objectContaining({ code: "STORE_CORRUPT" });
    expect(() => readDraftManifest(paths.dir)).toThrow(corrupt);
    expect(() => writePermissions(paths.dir, { ...NO_PERMISSIONS, reads: ["ticket"] })).toThrow(corrupt);
    expect(() => writeDraftManifest(paths.dir, ComponentManifest.parse(JSON.parse(before)))).toThrow(corrupt);
    expect(readFileSync(victim, "utf8")).toBe(before);
  });
  test("refuses a manifest hard-linked to an outside file", async () => {
    const paths = await prepared();
    const victim = join(home(), "victim.json");
    writeFileSync(victim, readFileSync(join(paths.dir, "kibo.component.json")));
    rmSync(join(paths.dir, "kibo.component.json"));
    linkSync(victim, join(paths.dir, "kibo.component.json"));
    expect(() => writePermissions(paths.dir, { ...NO_PERMISSIONS, reads: ["ticket"] })).toThrow(KiboError);
    expect(readFileSync(victim, "utf8")).not.toContain("ticket");
  });
  test("reads an unreadable manifest after restoring its mode", async () => {
    const paths = await prepared();
    chmodSync(join(paths.dir, "kibo.component.json"), 0);
    expect(readDraftManifest(paths.dir).id).toBe("burndown");
  });
});
