import { expect, test } from "bun:test";
import {
  actionLabel,
  actionOf,
  actionsFailed,
  classifyCommand,
  classifyTool,
  denialOf,
  MODIFYING_TOOLS,
  summarizeActions,
  type ToolCall,
  testCounts,
} from "./action-labels";
import type { RunAction } from "./moment";

const call = (over: Partial<ToolCall>): ToolCall => ({
  tool: "Read",
  input: {},
  output: null,
  isError: false,
  denied: false,
  patch: null,
  ...over,
});

const action = (over: Partial<RunAction>): RunAction => ({
  tool: "Read",
  kind: "read",
  label: "",
  target: null,
  outcome: "ok",
  detail: null,
  patch: null,
  tests: null,
  ...over,
});

test("tools are classified with their target", () => {
  expect(classifyTool("Read", { file_path: "/a/b.ts" })).toEqual({ kind: "read", target: "/a/b.ts" });
  expect(classifyTool("Grep", { pattern: "useForm" })).toEqual({ kind: "search", target: "useForm" });
  expect(classifyTool("Glob", { pattern: "**/*.ts" })).toEqual({ kind: "search", target: "**/*.ts" });
  expect(classifyTool("Edit", { file_path: "src/a.ts" })).toEqual({ kind: "edit", target: "src/a.ts" });
  expect(classifyTool("NotebookEdit", { notebook_path: "n.ipynb" })).toEqual({
    kind: "edit",
    target: "n.ipynb",
  });
  expect(classifyTool("Write", { file_path: "src/b.ts" })).toEqual({ kind: "create", target: "src/b.ts" });
  expect(classifyTool("TodoWrite", { todos: [] })).toEqual({ kind: "todo", target: null });
  expect(classifyTool("Task", { subagent_type: "kibo-dev" })).toEqual({
    kind: "subagent",
    target: "kibo-dev",
  });
  expect(classifyTool("mcp__kibo__ask_user", { question: "Quelle base ?" }).kind).toBe("question");
  expect(classifyTool("mcp__kibo__ticket_progress", { plan: [{}, {}] })).toEqual({
    kind: "progress",
    target: "plan:2",
  });
  expect(classifyTool("mcp__kibo__ticket_progress", { report: {} }).target).toBe("report");
  expect(classifyTool("mcp__github__list_prs", {})).toEqual({ kind: "mcp", target: "list_prs" });
  expect(classifyTool("WebFetch", {})).toEqual({ kind: "other", target: null });
  expect(classifyTool("Bash", { command: "bun test packages" }).kind).toBe("test");
  expect(MODIFYING_TOOLS).toEqual(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
});

test("shell commands are recognised", () => {
  expect(classifyCommand("bun test packages")).toEqual({ kind: "test", target: "bun test packages" });
  expect(classifyCommand("pnpm install").kind).toBe("install");
  expect(classifyCommand("bun add zod").kind).toBe("install");
  expect(classifyCommand('git commit -m "feat: x"')).toEqual({ kind: "git", target: "commit · feat: x" });
  expect(classifyCommand("git push")).toEqual({ kind: "git", target: "push" });
  expect(classifyCommand("git checkout -b feat/x")).toEqual({ kind: "git", target: "checkout · feat/x" });
  expect(classifyCommand("ls -la")).toEqual({ kind: "command", target: "ls -la" });
  expect(classifyCommand(`echo ${"x".repeat(200)}`).target).toHaveLength(120);
});

test("test counts are read from known runners", () => {
  expect(testCounts(" 12 pass\n 1 fail\n")).toEqual({ passed: 12, failed: 1 });
  expect(testCounts("Tests: 1 failed, 3 passed")).toEqual({ passed: 3, failed: 1 });
  expect(testCounts("Tests:  5 passed, 5 total")).toEqual({ passed: 5, failed: 0 });
  expect(testCounts("4 passed, 2 failed in 0.3s")).toEqual({ passed: 4, failed: 2 });
  expect(testCounts("ok")).toBeNull();
});

test("denials are recognised in the tool output", () => {
  expect(denialOf("Permission denied by the user")).toBe(true);
  expect(denialOf("The user doesn't want to proceed with this tool use.")).toBe(true);
  expect(denialOf("Outil refusé par Kibo")).toBe(true);
  expect(denialOf("all good")).toBe(false);
  expect(denialOf(null)).toBe(false);
});

test("the outcome of an action follows denial, then error", () => {
  expect(actionOf(call({ isError: true })).outcome).toBe("error");
  expect(actionOf(call({ isError: true, denied: true })).outcome).toBe("denied");
  const red = actionOf(call({ tool: "Bash", input: { command: "bun test" }, output: " 3 pass\n 1 fail" }));
  expect(red).toMatchObject({ kind: "test", outcome: "error", tests: { passed: 3, failed: 1 } });
  expect(actionOf(call({ tool: "Bash", input: { command: "make" }, output: "Exit code 2" })).outcome).toBe(
    "error",
  );
  expect(actionOf(call({ output: "x".repeat(5_000) })).detail).toHaveLength(4_000);
  const edit = actionOf(
    call({ tool: "Edit", input: { file_path: "src/LoginForm.tsx" }, patch: { added: 8, removed: 3 } }),
  );
  expect(edit).toMatchObject({ kind: "edit", outcome: "ok", label: "A modifié `LoginForm.tsx` (+8 −3)" });
});

test("each kind has a label in plain French", () => {
  const label = (over: Partial<RunAction>) => actionLabel(action(over));
  expect(label({ kind: "read", target: "/a/b.ts" })).toBe("A lu `b.ts`");
  expect(label({ kind: "search", target: "useForm" })).toBe("A cherché « useForm »");
  expect(label({ kind: "edit", target: "src/a.ts" })).toBe("A modifié `a.ts`");
  expect(label({ kind: "create", target: "src/b.ts" })).toBe("A créé `b.ts`");
  expect(label({ kind: "test", tests: { passed: 12, failed: 1 } })).toBe(
    "A lancé les tests (12 réussis, 1 échec)",
  );
  expect(label({ kind: "test" })).toBe("A lancé les tests");
  expect(label({ kind: "install" })).toBe("A installé les dépendances");
  expect(label({ kind: "git", target: "commit · feat: x" })).toBe("A commité « feat: x »");
  expect(label({ kind: "git", target: "push" })).toBe("A poussé");
  expect(label({ kind: "git", target: "checkout · feat/x" })).toBe("A changé de branche (feat/x)");
  expect(label({ kind: "git", target: "rebase · main" })).toBe("A lancé `git rebase main`");
  expect(label({ kind: "command", target: "ls -la" })).toBe("A lancé `ls -la`");
  expect(label({ kind: "question" })).toBe("A posé une question");
  expect(label({ kind: "progress", target: "plan:5" })).toBe("A déclaré son plan (5 étapes)");
  expect(label({ kind: "progress", target: "report" })).toBe("A remis son compte rendu");
  expect(label({ kind: "progress", target: "plan:1,report" })).toBe(
    "A déclaré son plan (1 étape) et remis son compte rendu",
  );
  expect(label({ kind: "todo" })).toBe("A mis à jour sa liste de tâches");
  expect(label({ kind: "subagent", target: "kibo-dev" })).toBe("A lancé un sous-agent kibo-dev");
  expect(label({ kind: "mcp", target: "list_prs" })).toBe("A appelé list_prs");
  expect(label({ kind: "other", tool: "WebFetch" })).toBe("A utilisé un outil WebFetch");
  expect(label({ kind: "other", tool: "" })).toBe("A utilisé un outil");
});

test("a group of actions is summarised in a fixed order", () => {
  const actions = [
    action({ kind: "read", target: "a.ts" }),
    action({ kind: "read", target: "b.ts" }),
    action({ kind: "read", target: "c.ts" }),
    action({ kind: "edit", target: "a.ts" }),
    action({ kind: "edit", target: "b.ts" }),
    action({ kind: "test", tests: { passed: 12, failed: 1 }, outcome: "error" }),
  ];
  expect(summarizeActions(actions)).toBe(
    "A lu 3 fichiers, modifié 2 fichiers et lancé les tests (12 réussis, 1 échec)",
  );
  expect(summarizeActions([action({ kind: "read", target: "a.ts" })])).toBe("A lu 1 fichier");
  expect(summarizeActions([action({ kind: "command", target: "ls" })])).toBe("A lancé `ls`");
  expect(
    summarizeActions([action({ kind: "command", target: "ls" }), action({ kind: "command", target: "pwd" })]),
  ).toBe("A lancé 2 commandes");
  expect(summarizeActions([])).toBe("");
  expect(actionsFailed(actions)).toBe(true);
  expect(actionsFailed(actions.slice(0, 5))).toBe(false);
});

test("a signal to the project agent is its own action", () => {
  const input = { kind: "ticket", title: "Tests du récepteur" };
  expect(classifyTool("mcp__kibo__signal_project", input)).toEqual({
    kind: "signal",
    target: "Tests du récepteur",
  });
  const signal = actionOf(call({ tool: "mcp__kibo__signal_project", input }));
  expect(signal.label).toBe("A signalé « Tests du récepteur » à l'agent de projet");
  expect(summarizeActions([signal])).toBe("A envoyé 1 signal");
  expect(summarizeActions([signal, signal])).toBe("A envoyé 2 signaux");
  expect(summarizeActions([action({ kind: "read", target: "a.ts" }), signal])).toBe(
    "A lu 1 fichier et envoyé 1 signal",
  );
});
