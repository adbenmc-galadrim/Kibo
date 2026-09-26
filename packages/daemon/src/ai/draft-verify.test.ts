import { describe, expect, test } from "bun:test";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readDraftManifest, verifyAndRestore } from "./draft-files";
import { cleanHomes, home, prepared } from "./testing/draft-fixture";

cleanHomes();

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
    expect(verifyAndRestore(paths, false)).toEqual([
      { kind: "removed", path: "sub" },
      { kind: "removed", path: "sub/ui.tsx" },
    ]);
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
