import { describe, expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { KiboError } from "@kibo/schema";
import {
  agentFiles,
  draftPaths,
  isAgentFile,
  prepareDraft,
  readDraftManifest,
  verifyAndRestore,
} from "./draft-files";
import { cleanHomes, home, kiboFiles, prepared, scaffold } from "./testing/draft-fixture";

cleanHomes();

test("draftPaths places the draft and its base under components/drafts", () => {
  expect(draftPaths("/h", "d1")).toEqual({
    dir: "/h/components/drafts/d1",
    baseDir: "/h/components/drafts/d1.base",
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

describe("verifyAndRestore", () => {
  test("keeps agent files, restores reserved ones, removes unexpected ones", async () => {
    const paths = await prepared();
    writeFileSync(join(paths.dir, "ui.tsx"), "export const Component = () => 1;\n");
    writeFileSync(join(paths.dir, "kibo.component.json"), "{}");
    rmSync(join(paths.dir, "tsconfig.json"));
    writeFileSync(join(paths.dir, "evil.ts"), "x");
    mkdirSync(join(paths.dir, "node_modules"));
    writeFileSync(join(paths.dir, "node_modules", "ignored.js"), "x");
    mkdirSync(join(paths.dir, ".kibo"));
    writeFileSync(join(paths.dir, ".kibo", "validation.json"), "{}");
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "removed", path: "evil.ts" },
      { kind: "restored", path: "kibo.component.json" },
      { kind: "restored", path: "tsconfig.json" },
    ]);
    expect(readDraftManifest(paths.dir).id).toBe("burndown");
    expect(readFileSync(join(paths.dir, "ui.tsx"), "utf8")).toContain("=> 1");
    expect(existsSync(join(paths.dir, "node_modules", "ignored.js"))).toBe(true);
    expect(existsSync(join(paths.dir, ".kibo", "validation.json"))).toBe(true);
  });
  test("an untouched draft has no incident", async () => {
    const paths = await prepared();
    expect(verifyAndRestore(paths, false)).toEqual([]);
  });
  test("replaces a symbolic link, even on an agent file", async () => {
    const paths = await prepared();
    rmSync(join(paths.dir, "ui.tsx"));
    symlinkSync("/etc/hosts", join(paths.dir, "ui.tsx"));
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "restored", path: "ui.tsx" }]);
    expect(lstatSync(join(paths.dir, "ui.tsx")).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(paths.dir, "ui.tsx"), "utf8")).toContain("=> null");
  });
  test("removes a symbolic link to a directory without touching its target", async () => {
    const h = home();
    const outside = join(h, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "secret.txt"), "s");
    const paths = await prepared();
    rmSync(join(paths.dir, ".claude"), { recursive: true });
    symlinkSync(outside, join(paths.dir, ".claude"));
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "removed", path: ".claude" },
      { kind: "restored", path: ".claude/skills/kibo-component/SKILL.md" },
    ]);
    expect(lstatSync(join(paths.dir, ".claude")).isDirectory()).toBe(true);
    expect(readFileSync(join(outside, "secret.txt"), "utf8")).toBe("s");
    expect(existsSync(join(outside, "skills"))).toBe(false);
  });
  test("removes a symbolic link hidden in a subfolder", async () => {
    const paths = await prepared();
    symlinkSync("/etc/hosts", join(paths.dir, ".claude", "link.md"));
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "removed", path: ".claude/link.md" }]);
    expect(existsSync(join(paths.dir, ".claude", "link.md"))).toBe(false);
  });
  test("removes agent-named files outside the root", async () => {
    const paths = await prepared();
    mkdirSync(join(paths.dir, "sub"));
    writeFileSync(join(paths.dir, "sub", "ui.tsx"), "x");
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "removed", path: "sub/ui.tsx" }]);
    expect(existsSync(join(paths.dir, "sub", "ui.tsx"))).toBe(false);
  });
  test("restores a reserved file replaced by a folder", async () => {
    const paths = await prepared();
    rmSync(join(paths.dir, "tsconfig.json"));
    mkdirSync(join(paths.dir, "tsconfig.json"));
    writeFileSync(join(paths.dir, "tsconfig.json", "x.ts"), "x");
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "restored", path: "tsconfig.json" },
      { kind: "removed", path: "tsconfig.json/x.ts" },
    ]);
    expect(readFileSync(join(paths.dir, "tsconfig.json"), "utf8")).toBe("{}\n");
  });
  test("restores a modified Kibo file", async () => {
    const paths = await prepared();
    writeFileSync(join(paths.dir, "CLAUDE.md"), "# Autres règles\n");
    writeFileSync(join(paths.dir, ".claude/skills/kibo-component/SKILL.md"), "x");
    expect(verifyAndRestore(paths, true)).toEqual([
      { kind: "restored", path: ".claude/skills/kibo-component/SKILL.md" },
      { kind: "restored", path: "CLAUDE.md" },
    ]);
    expect(readFileSync(join(paths.dir, "CLAUDE.md"), "utf8")).toBe("# Règles\n");
  });
  test("restores component.test.tsx when runConformance is gone", async () => {
    const paths = await prepared();
    writeFileSync(join(paths.dir, "component.test.tsx"), "test('x', () => {});\n");
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "restored", path: "component.test.tsx" }]);
    expect(readFileSync(join(paths.dir, "component.test.tsx"), "utf8")).toContain("runConformance(");
  });
  test("restores a deleted component.test.tsx", async () => {
    const paths = await prepared();
    rmSync(join(paths.dir, "component.test.tsx"));
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "restored", path: "component.test.tsx" }]);
  });
  test("keeps an edited component.test.tsx that still calls runConformance", async () => {
    const paths = await prepared();
    writeFileSync(
      join(paths.dir, "component.test.tsx"),
      "runConformance({ manifest, Component });\ntest('y');\n",
    );
    expect(verifyAndRestore(paths, false)).toEqual([]);
  });
  test("server.ts is removed when the draft has no backend", async () => {
    const paths = await prepared();
    writeFileSync(join(paths.dir, "server.ts"), "x");
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "removed", path: "server.ts" }]);
    writeFileSync(join(paths.dir, "server.ts"), "x");
    expect(verifyAndRestore(paths, true)).toEqual([]);
  });
});

const mkfifo = (path: string) => expect(Bun.spawnSync(["mkfifo", path]).exitCode).toBe(0);

describe("verifyAndRestore against a hostile draft", () => {
  test("refuses a draft folder replaced by a symbolic link and touches nothing outside", async () => {
    const paths = await prepared();
    const victim = join(home(), "victim");
    mkdirSync(victim);
    writeFileSync(join(victim, "precious.txt"), "keep me");
    rmSync(paths.dir, { recursive: true });
    symlinkSync(victim, paths.dir);
    expect(() => verifyAndRestore(paths, false)).toThrow(KiboError);
    expect(() => verifyAndRestore(paths, false)).toThrow(expect.objectContaining({ code: "STORE_CORRUPT" }));
    expect(() => agentFiles(paths, false)).toThrow(expect.objectContaining({ code: "STORE_CORRUPT" }));
    expect(readFileSync(join(victim, "precious.txt"), "utf8")).toBe("keep me");
  });
  test("refuses a base folder replaced by a symbolic link", async () => {
    const paths = await prepared();
    const victim = join(home(), "victim");
    mkdirSync(victim);
    writeFileSync(join(victim, "precious.txt"), "keep me");
    rmSync(paths.baseDir, { recursive: true });
    symlinkSync(victim, paths.baseDir);
    writeFileSync(join(paths.dir, "evil.ts"), "x");
    expect(() => verifyAndRestore(paths, false)).toThrow(expect.objectContaining({ code: "STORE_CORRUPT" }));
    expect(() => agentFiles(paths, false)).toThrow(expect.objectContaining({ code: "STORE_CORRUPT" }));
    expect(readFileSync(join(victim, "precious.txt"), "utf8")).toBe("keep me");
  });
  test("refuses a draft folder replaced by a file", async () => {
    const paths = await prepared();
    rmSync(paths.dir, { recursive: true });
    writeFileSync(paths.dir, "x");
    expect(() => verifyAndRestore(paths, false)).toThrow(expect.objectContaining({ code: "STORE_CORRUPT" }));
  });
  test("restores component.test.tsx replaced by a FIFO without blocking", async () => {
    const paths = await prepared();
    rmSync(join(paths.dir, "component.test.tsx"));
    mkfifo(join(paths.dir, "component.test.tsx"));
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "restored", path: "component.test.tsx" }]);
    expect(readFileSync(join(paths.dir, "component.test.tsx"), "utf8")).toContain("runConformance(");
  });
  test("removes an unexpected FIFO", async () => {
    const paths = await prepared();
    mkfifo(join(paths.dir, "pipe"));
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "removed", path: "pipe" }]);
    expect(existsSync(join(paths.dir, "pipe"))).toBe(false);
  });
  test("restores component.test.tsx replaced by a folder", async () => {
    const paths = await prepared();
    rmSync(join(paths.dir, "component.test.tsx"));
    mkdirSync(join(paths.dir, "component.test.tsx"));
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "restored", path: "component.test.tsx" }]);
    expect(readFileSync(join(paths.dir, "component.test.tsx"), "utf8")).toContain("runConformance(");
  });
  test("an agent file replaced by a folder is restored from the base", async () => {
    const paths = await prepared();
    rmSync(join(paths.dir, "ui.tsx"));
    mkdirSync(join(paths.dir, "ui.tsx"));
    writeFileSync(join(paths.dir, "ui.tsx", "x.ts"), "x");
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "restored", path: "ui.tsx" }]);
    expect(readFileSync(join(paths.dir, "ui.tsx"), "utf8")).toContain("=> null");
  });
  test("an agent-named folder unknown to the base is removed", async () => {
    const paths = await prepared();
    mkdirSync(join(paths.dir, "burndown.test.tsx"));
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "removed", path: "burndown.test.tsx" }]);
    expect(existsSync(join(paths.dir, "burndown.test.tsx"))).toBe(false);
  });
});

test("agentFiles lists agent files of the draft and of its base", async () => {
  const paths = await prepared();
  writeFileSync(join(paths.dir, "burndown.test.tsx"), "x");
  expect(agentFiles(paths, false)).toEqual(["burndown.test.tsx", "component.test.tsx", "ui.tsx"]);
});
