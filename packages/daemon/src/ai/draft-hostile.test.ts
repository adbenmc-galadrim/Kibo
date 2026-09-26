import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { agentFiles, removeDraft, verifyAndRestore } from "./draft-files";
import { installDraft } from "./draft-source";
import { cleanHomes, home, prepared } from "./testing/draft-fixture";

cleanHomes();

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
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "restored", path: "ui.tsx" },
      { kind: "removed", path: "ui.tsx/x.ts" },
    ]);
    expect(readFileSync(join(paths.dir, "ui.tsx"), "utf8")).toContain("=> null");
  });
  test("an agent-named folder unknown to the base is removed", async () => {
    const paths = await prepared();
    mkdirSync(join(paths.dir, "burndown.test.tsx"));
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "removed", path: "burndown.test.tsx" }]);
    expect(existsSync(join(paths.dir, "burndown.test.tsx"))).toBe(false);
  });
  test("removes empty folders unknown to the base, including agent names", async () => {
    const paths = await prepared();
    mkdirSync(join(paths.dir, "server.ts"));
    mkdirSync(join(paths.dir, "migrations.ts"));
    mkdirSync(join(paths.dir, "evil", "deep"), { recursive: true });
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "removed", path: "evil" },
      { kind: "removed", path: "migrations.ts" },
      { kind: "removed", path: "server.ts" },
    ]);
    mkdirSync(join(paths.dir, "server.ts"));
    expect(verifyAndRestore(paths, true)).toEqual([{ kind: "removed", path: "server.ts" }]);
    const src = join(home(), "src", "burndown");
    installDraft(paths.dir, src).commit();
    expect(readdirSync(src).sort()).toEqual([
      "component.test.tsx",
      "kibo.component.json",
      "tsconfig.json",
      "ui.tsx",
    ]);
  });
  test("replaces a hard link to an outside file", async () => {
    const paths = await prepared();
    const victim = join(home(), "secret.txt");
    writeFileSync(victim, "SECRET");
    rmSync(join(paths.dir, "ui.tsx"));
    linkSync(victim, join(paths.dir, "ui.tsx"));
    linkSync(victim, join(paths.dir, "copy.ts"));
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "removed", path: "copy.ts" },
      { kind: "restored", path: "ui.tsx" },
    ]);
    expect(readFileSync(join(paths.dir, "ui.tsx"), "utf8")).toContain("=> null");
    expect(readFileSync(victim, "utf8")).toBe("SECRET");
    expect(statSync(victim).nlink).toBe(1);
  });
});

describe("verifyAndRestore on a draft with changed permissions", () => {
  test("restores inside a read-only subfolder and removeDraft deletes everything", async () => {
    const paths = await prepared();
    mkdirSync(join(paths.dir, "sub"));
    writeFileSync(join(paths.dir, "sub", "x.ts"), "x");
    chmodSync(join(paths.dir, "sub"), 0o500);
    chmodSync(join(paths.dir, ".claude", "skills"), 0);
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "removed", path: "sub" },
      { kind: "removed", path: "sub/x.ts" },
    ]);
    removeDraft(paths);
    expect(existsSync(paths.dir) || existsSync(paths.baseDir)).toBe(false);
  });
  test("restores a reserved file whose mode is 0", async () => {
    const paths = await prepared();
    writeFileSync(join(paths.dir, "tsconfig.json"), '{ "x": 1 }');
    chmodSync(join(paths.dir, "tsconfig.json"), 0);
    chmodSync(join(paths.baseDir, "kibo.component.json"), 0);
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "restored", path: "tsconfig.json" }]);
    expect(readFileSync(join(paths.dir, "tsconfig.json"), "utf8")).toBe("{}\n");
  });
  test("works on a read-only draft root", async () => {
    const paths = await prepared();
    writeFileSync(join(paths.dir, "evil.ts"), "x");
    chmodSync(paths.dir, 0o500);
    chmodSync(paths.baseDir, 0o500);
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "removed", path: "evil.ts" }]);
    expect(statSync(paths.dir).mode & 0o777).toBe(0o700);
  });
  test("removeDraft unlocks ignored folders too", async () => {
    const paths = await prepared();
    mkdirSync(join(paths.dir, "node_modules", "m"), { recursive: true });
    writeFileSync(join(paths.dir, "node_modules", "m", "i.js"), "x");
    chmodSync(join(paths.dir, "node_modules", "m"), 0o500);
    chmodSync(paths.dir, 0o500);
    removeDraft(paths);
    expect(existsSync(paths.dir)).toBe(false);
  });
});

describe("verifyAndRestore and case-insensitive names", () => {
  test("an agent file replaced by a folder differing in case is removed", async () => {
    const paths = await prepared();
    rmSync(join(paths.dir, "ui.tsx"));
    mkdirSync(join(paths.dir, "UI.tsx"));
    writeFileSync(join(paths.dir, "UI.tsx", "x.ts"), "x");
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "removed", path: "UI.tsx" },
      { kind: "removed", path: "UI.tsx/x.ts" },
    ]);
    expect(lstatSync(join(paths.dir, "ui.tsx"), { throwIfNoEntry: false })).toBeUndefined();
    expect(agentFiles(paths, false)).toEqual(["component.test.tsx", "ui.tsx"]);
  });
  test("a folder Server.ts is removed even with a backend", async () => {
    const paths = await prepared();
    mkdirSync(join(paths.dir, "Server.ts"));
    expect(verifyAndRestore(paths, true)).toEqual([{ kind: "removed", path: "Server.ts" }]);
    expect(readdirSync(paths.dir)).not.toContain("Server.ts");
  });
  test("an agent file renamed with another case is reported", async () => {
    const paths = await prepared();
    renameSync(join(paths.dir, "ui.tsx"), join(paths.dir, "UI.tsx"));
    expect(verifyAndRestore(paths, false)).toEqual([{ kind: "removed", path: "UI.tsx" }]);
    expect(readdirSync(paths.dir)).not.toContain("UI.tsx");
  });
  test("a reserved folder renamed with another case is rebuilt", async () => {
    const paths = await prepared();
    renameSync(join(paths.dir, ".claude"), join(paths.dir, ".Claude"));
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "removed", path: ".Claude" },
      { kind: "removed", path: ".Claude/skills/kibo-component/SKILL.md" },
      { kind: "restored", path: ".claude/skills/kibo-component/SKILL.md" },
    ]);
    expect(readdirSync(paths.dir)).toContain(".claude");
  });
});

describe("verifyAndRestore and build outputs", () => {
  test("removes a .kibo or dist folder replaced by a link or a special file", async () => {
    const paths = await prepared();
    const victim = join(home(), "victim");
    mkdirSync(victim);
    writeFileSync(join(victim, "validation.json"), "keep");
    symlinkSync(victim, join(paths.dir, ".kibo"));
    mkfifo(join(paths.dir, "dist"));
    symlinkSync("/etc/hosts", join(paths.dir, "tsconfig.tsbuildinfo"));
    chmodSync(paths.dir, 0o500);
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "removed", path: ".kibo" },
      { kind: "removed", path: "dist" },
      { kind: "removed", path: "tsconfig.tsbuildinfo" },
    ]);
    expect(readFileSync(join(victim, "validation.json"), "utf8")).toBe("keep");
  });
  test("removes links inside .kibo and dist but keeps their files and node_modules", async () => {
    const paths = await prepared();
    mkdirSync(join(paths.dir, ".kibo"));
    writeFileSync(join(paths.dir, ".kibo", "stamp.json"), "{}");
    symlinkSync("/etc/hosts", join(paths.dir, ".kibo", "validation.json"));
    mkdirSync(join(paths.dir, "dist"));
    linkSync(join(paths.baseDir, "tsconfig.json"), join(paths.dir, "dist", "ui.js"));
    symlinkSync(home(), join(paths.dir, "node_modules"));
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "removed", path: ".kibo/validation.json" },
      { kind: "removed", path: "dist/ui.js" },
    ]);
    expect(existsSync(join(paths.dir, ".kibo", "stamp.json"))).toBe(true);
    expect(lstatSync(join(paths.dir, "node_modules")).isSymbolicLink()).toBe(true);
  });
});
