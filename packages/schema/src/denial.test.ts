import { expect, test } from "bun:test";
import { DENIAL_ITEMS_MAX, isClaudeDenial, proposeRules, RESUME_AFTER_ALLOW } from "./denial";

const CTX = { home: "/Users/a", cwd: "/Users/a/Documents/emis-feat", known: ["/Users/a/.claude/skills"] };
const bash = (target: string) => ({ tool: "Bash", target });
const rulesOf = (actions: { tool: string; target: string | null }[]) =>
  proposeRules(actions, CTX).map((i) => i.rule);

test("a compound command gives one rule per simple command", () => {
  expect(rulesOf([bash("cd /x; git fetch && pnpm test | tail")])).toEqual([
    "Bash(cd *)",
    "Bash(git *)",
    "Bash(pnpm *)",
    "Bash(tail *)",
  ]);
  expect(proposeRules([bash("git fetch && pnpm test")], CTX)).toEqual([
    { tool: "Bash", target: "git fetch", rule: "Bash(git *)", addDir: null, reason: "ok" },
    { tool: "Bash", target: "pnpm test", rule: "Bash(pnpm *)", addDir: null, reason: "ok" },
  ]);
});

test("leading assignments are skipped", () => {
  expect(rulesOf([bash("FOO=1 BAR=x pnpm test")])).toEqual(["Bash(pnpm *)"]);
});

test("wrappers that run anything are never proposed", () => {
  for (const command of ['sh -c "git fetch && pnpm test"', "env X=1 pnpm", "xargs rm", "bash run.sh"]) {
    const items = proposeRules([bash(command)], CTX);
    expect(items).toHaveLength(1);
    expect(items[0]?.rule).toBeNull();
    expect(items[0]?.reason).toBe("shell");
  }
});

test("a background operator splits the command, redirections do not", () => {
  expect(rulesOf([bash("pnpm dev & curl localhost")])).toEqual(["Bash(pnpm *)", "Bash(curl *)"]);
  expect(rulesOf([bash("pnpm test 2>&1 | tail")])).toEqual(["Bash(pnpm *)", "Bash(tail *)"]);
  expect(rulesOf([bash("pnpm build &> out.log &")])).toEqual(["Bash(pnpm *)"]);
});

test("operators inside quotes do not split the command", () => {
  expect(rulesOf([bash("git commit -m 'a && b; c | d'")])).toEqual(["Bash(git *)"]);
});

test("a read outside the working folder proposes a folder", () => {
  const read = { tool: "Read", target: "/Users/a/.claude/skills/full-delivery/reference/kibo.md" };
  expect(proposeRules([read], CTX)).toEqual([
    { tool: "Read", target: read.target, rule: null, addDir: "/Users/a/.claude/skills", reason: "ok" },
  ]);
  const tilde = { tool: "Read", target: "~/.claude/skills/full-delivery/SKILL.md" };
  expect(proposeRules([tilde], CTX)[0]?.addDir).toBe("/Users/a/.claude/skills");
  const other = { tool: "Grep", target: "/Users/a/Documents/emis/notes/todo.md" };
  expect(proposeRules([other], CTX)[0]?.addDir).toBe("/Users/a/Documents/emis/notes");
});

test("a read inside the working folder or a relative one proposes nothing", () => {
  expect(proposeRules([{ tool: "Read", target: `${CTX.cwd}/src/a.ts` }], CTX)).toEqual([]);
  expect(proposeRules([{ tool: "Read", target: "src/a.ts" }], CTX)).toEqual([]);
  expect(proposeRules([{ tool: "Read", target: null }], CTX)).toEqual([]);
});

test("a read of a secret folder or outside the home proposes no folder", () => {
  for (const target of ["/Users/a/.ssh/id_rsa", "/etc/hosts", "/Users/a/.kibo/token"]) {
    const [item] = proposeRules([{ tool: "Read", target }], CTX);
    expect(item?.addDir).toBeNull();
    expect(item?.reason).toBe("unknown");
  }
});

test("edits, web and other tools", () => {
  expect(proposeRules([{ tool: "Edit", target: "/x/a.ts" }], CTX)[0]?.rule).toBe("Edit");
  expect(proposeRules([{ tool: "Write", target: "/x/a.ts" }], CTX)[0]?.rule).toBe("Write");
  expect(proposeRules([{ tool: "WebFetch", target: "https://docs.example.com/a?b" }], CTX)[0]?.rule).toBe(
    "WebFetch(domain:docs.example.com)",
  );
  expect(proposeRules([{ tool: "WebFetch", target: "not a url" }], CTX)[0]?.reason).toBe("unknown");
  expect(proposeRules([{ tool: "WebSearch", target: "bun" }], CTX)[0]?.rule).toBe("WebSearch");
  expect(proposeRules([{ tool: "mcp__kibo__peek_work", target: "peek_work" }], CTX)[0]).toEqual({
    tool: "mcp__kibo__peek_work",
    target: "peek_work",
    rule: null,
    addDir: null,
    reason: "mcp",
  });
  expect(proposeRules([{ tool: "Mystery", target: "x" }], CTX)[0]?.reason).toBe("unknown");
});

test("proposals are deduplicated and bounded", () => {
  expect(rulesOf([bash("pnpm test"), bash("pnpm lint && pnpm test")])).toEqual(["Bash(pnpm *)"]);
  const many = Array.from({ length: 25 }, (_, i) => bash(`tool${i} run`));
  expect(proposeRules(many, CTX)).toHaveLength(DENIAL_ITEMS_MAX);
  expect(DENIAL_ITEMS_MAX).toBe(20);
  const long = proposeRules([{ tool: "Mystery", target: "x".repeat(900) }], CTX);
  expect(long[0]?.target.length).toBe(500);
});

test("only Claude Code refusals count", () => {
  expect(
    isClaudeDenial(
      "Permission for this tool use was denied. It requires approval, and this session has no approval surface",
    ),
  ).toBe(true);
  expect(isClaudeDenial("This command requires approval")).toBe(true);
  expect(isClaudeDenial("non autorisé par Kibo")).toBe(false);
  expect(isClaudeDenial("requires approval — non autorisé par Kibo")).toBe(false);
  expect(isClaudeDenial(null)).toBe(false);
  expect(isClaudeDenial("Exit code 1")).toBe(false);
});

test("the resume text names what is now allowed", () => {
  expect(RESUME_AFTER_ALLOW(["Bash(pnpm *)", "Bash(git *)"], ["/Users/a/.claude/skills"])).toBe(
    "Kibo : les règles `Bash(pnpm *)`, `Bash(git *)` et les dossiers `/Users/a/.claude/skills` sont maintenant autorisés. Reprends là où tu t'es arrêté, sans refaire ce qui est déjà fait.",
  );
  expect(RESUME_AFTER_ALLOW(["Bash(pnpm *)"], [])).toBe(
    "Kibo : les règles `Bash(pnpm *)` sont maintenant autorisées. Reprends là où tu t'es arrêté, sans refaire ce qui est déjà fait.",
  );
  expect(RESUME_AFTER_ALLOW([], ["/Users/a/x"])).toBe(
    "Kibo : les dossiers `/Users/a/x` sont maintenant autorisés. Reprends là où tu t'es arrêté, sans refaire ce qui est déjà fait.",
  );
});
