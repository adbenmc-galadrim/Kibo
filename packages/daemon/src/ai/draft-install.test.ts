import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { copySource, installDraft, removeDraft } from "./draft-files";
import { cleanHomes, home, prepared } from "./testing/draft-fixture";

cleanHomes();

describe("copySource and installDraft", () => {
  test("copySource skips symbolic links, node_modules and dist", () => {
    const h = home();
    const src = join(h, "src");
    const dir = join(h, "dir");
    mkdirSync(join(src, "dist"), { recursive: true });
    mkdirSync(join(src, "node_modules"));
    mkdirSync(dir);
    writeFileSync(join(src, "ui.tsx"), "x");
    writeFileSync(join(src, "dist", "ui.js"), "x");
    writeFileSync(join(src, "node_modules", "m.js"), "x");
    symlinkSync("/etc/hosts", join(src, "link.ts"));
    copySource(src, dir);
    expect(existsSync(join(dir, "ui.tsx"))).toBe(true);
    expect(existsSync(join(dir, "dist"))).toBe(false);
    expect(existsSync(join(dir, "node_modules"))).toBe(false);
    expect(existsSync(join(dir, "link.ts"))).toBe(false);
  });
  test("installDraft copies without Kibo files and rolls back to the previous source", async () => {
    const paths = await prepared();
    const src = join(dirname(dirname(paths.dir)), "src", "burndown");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "ui.tsx"), "old");
    const install = installDraft(paths.dir, src);
    expect(existsSync(join(src, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(src, ".claude"))).toBe(false);
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toContain("=> null");
    install.rollback();
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("old");
    expect(readdirSync(dirname(src))).toEqual(["burndown"]);
  });
  test("installDraft ignores node_modules, .kibo and symbolic links", async () => {
    const paths = await prepared();
    mkdirSync(join(paths.dir, "node_modules"));
    mkdirSync(join(paths.dir, ".kibo"));
    writeFileSync(join(paths.dir, ".kibo", "validation.json"), "{}");
    symlinkSync("/etc/hosts", join(paths.dir, "link.ts"));
    const src = join(home(), "src", "burndown");
    installDraft(paths.dir, src).commit();
    expect(readdirSync(src).sort()).toEqual([
      "component.test.tsx",
      "kibo.component.json",
      "tsconfig.json",
      "ui.tsx",
    ]);
  });
  test("commit drops the backup of the previous source", async () => {
    const paths = await prepared();
    const src = join(home(), "src", "burndown");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "old.tsx"), "old");
    installDraft(paths.dir, src).commit();
    expect(existsSync(join(src, "old.tsx"))).toBe(false);
    expect(readdirSync(dirname(src))).toEqual(["burndown"]);
  });
  test("rollback of a first install removes the source", async () => {
    const paths = await prepared();
    const src = join(home(), "src", "burndown");
    installDraft(paths.dir, src).rollback();
    expect(existsSync(src)).toBe(false);
  });
  test("removeDraft deletes the draft and its base", async () => {
    const paths = await prepared();
    removeDraft(paths);
    expect(existsSync(paths.dir) || existsSync(paths.baseDir)).toBe(false);
  });
});

describe("installDraft against a hostile draft", () => {
  test("refuses a draft folder replaced by a symbolic link", async () => {
    const paths = await prepared();
    const victim = join(home(), "victim");
    mkdirSync(victim);
    rmSync(paths.dir, { recursive: true });
    symlinkSync(victim, paths.dir);
    const src = join(home(), "src", "burndown");
    expect(() => installDraft(paths.dir, src)).toThrow(expect.objectContaining({ code: "STORE_CORRUPT" }));
    expect(existsSync(src)).toBe(false);
  });
  test("keeps Kibo files out whatever their case", async () => {
    const paths = await prepared();
    renameSync(join(paths.dir, ".claude"), join(paths.dir, ".Claude"));
    renameSync(join(paths.dir, "CLAUDE.md"), join(paths.dir, "Claude.md"));
    const src = join(home(), "src", "burndown");
    installDraft(paths.dir, src).commit();
    expect(readdirSync(src).filter((n) => [".claude", "claude.md"].includes(n.toLowerCase()))).toEqual([]);
  });
  test("rollback after commit keeps the installed source", async () => {
    const paths = await prepared();
    const src = join(home(), "src", "burndown");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "ui.tsx"), "old");
    const install = installDraft(paths.dir, src);
    install.commit();
    install.rollback();
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toContain("=> null");
  });
  test("a second rollback or a commit after rollback changes nothing", async () => {
    const paths = await prepared();
    const src = join(home(), "src", "burndown");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "ui.tsx"), "old");
    const install = installDraft(paths.dir, src);
    install.rollback();
    install.rollback();
    install.commit();
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("old");
    expect(readdirSync(dirname(src))).toEqual(["burndown"]);
  });
  test("puts back a backup left by a crash before installing", async () => {
    const paths = await prepared();
    const src = join(home(), "src", "burndown");
    const backup = join(dirname(src), ".burndown.kibo-backup");
    mkdirSync(backup, { recursive: true });
    writeFileSync(join(backup, "ui.tsx"), "the only good copy");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "partial.tsx"), "half");
    installDraft(paths.dir, src).rollback();
    expect(readdirSync(src)).toEqual(["ui.tsx"]);
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("the only good copy");
    expect(existsSync(backup)).toBe(false);
  });
  test("a trash left by a crash during commit is deleted, never restored", async () => {
    const paths = await prepared();
    const src = join(home(), "src", "burndown");
    installDraft(paths.dir, src).commit();
    const trash = join(dirname(src), ".burndown.kibo-trash");
    mkdirSync(trash);
    writeFileSync(join(trash, "kibo.component.json"), "{}");
    installDraft(paths.dir, src).rollback();
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toContain("=> null");
    expect(readdirSync(dirname(src))).toEqual(["burndown"]);
  });
  test("commit leaves neither backup nor trash", async () => {
    const paths = await prepared();
    const src = join(home(), "src", "burndown");
    mkdirSync(src, { recursive: true });
    mkdirSync(join(src, "locked"));
    writeFileSync(join(src, "locked", "old.tsx"), "old");
    chmodSync(join(src, "locked"), 0o500);
    installDraft(paths.dir, src).commit();
    expect(readdirSync(dirname(src))).toEqual(["burndown"]);
  });
  test("never copies special files or hard links", async () => {
    const paths = await prepared();
    const victim = join(home(), "secret.txt");
    writeFileSync(victim, "SECRET");
    linkSync(victim, join(paths.dir, "copy.ts"));
    expect(Bun.spawnSync(["mkfifo", join(paths.dir, "pipe")]).exitCode).toBe(0);
    const src = join(home(), "src", "burndown");
    installDraft(paths.dir, src).commit();
    expect(readdirSync(src).sort()).toEqual([
      "component.test.tsx",
      "kibo.component.json",
      "tsconfig.json",
      "ui.tsx",
    ]);
  });
});
