import { type ActionKind, MOMENT_DETAIL_MAX, type RunAction } from "./moment";
import { PROGRESS_TOOL } from "./progress";
import { ASK_TOOLS } from "./run";

export type ToolCall = {
  tool: string;
  input: Record<string, unknown>;
  output: string | null;
  isError: boolean;
  denied: boolean;
  patch: { added: number; removed: number } | null;
};
type Classified = { kind: ActionKind; target: string | null };
type Counts = { passed: number; failed: number };

export const MODIFYING_TOOLS: readonly string[] = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
const COMMAND_MAX = 120;
const SEP = " · ";

const text = (input: Record<string, unknown>, key: string): string | null => {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value : null;
};

function progressTarget(input: Record<string, unknown>): string {
  const plan = Array.isArray(input.plan) ? [`plan:${input.plan.length}`] : [];
  const report = input.report !== undefined && input.report !== null ? ["report"] : [];
  return [...plan, ...report].join(",");
}

const FILE_KINDS: Record<string, Classified["kind"]> = {
  Read: "read",
  Edit: "edit",
  MultiEdit: "edit",
  Write: "create",
};

export function classifyTool(tool: string, input: Record<string, unknown>): Classified {
  const fileKind = FILE_KINDS[tool];
  if (fileKind) return { kind: fileKind, target: text(input, "file_path") };
  if (tool === "NotebookEdit") return { kind: "edit", target: text(input, "notebook_path") };
  if (tool === "Grep" || tool === "Glob") return { kind: "search", target: text(input, "pattern") };
  if (tool === "Bash") return classifyCommand(text(input, "command") ?? "");
  if (tool === "TodoWrite") return { kind: "todo", target: null };
  if (tool === "Task" || tool === "Agent") return { kind: "subagent", target: text(input, "subagent_type") };
  if (ASK_TOOLS.includes(tool)) return { kind: "question", target: text(input, "question") };
  if (tool === PROGRESS_TOOL) return { kind: "progress", target: progressTarget(input) };
  if (tool.startsWith("mcp__")) return { kind: "mcp", target: tool.split("__").at(-1) ?? tool };
  return { kind: "other", target: null };
}

const TEST_COMMAND = /\b(bun test|vitest|jest|pytest|npm test|pnpm test|yarn test)\b/;
const INSTALL_COMMAND = /\b(bun|npm|pnpm|yarn) (install|add|i)\b|pip install|cargo add/;
const GIT_COMMAND = /^git (commit|push|checkout|switch|rebase|merge)\b(.*)$/s;
const COMMIT_MESSAGE = /(?:^|\s)-m\s+(?:"([^"]*)"|'([^']*)'|(\S+))/;

function gitArgument(sub: string, rest: string): string | null {
  if (sub === "commit") {
    const m = COMMIT_MESSAGE.exec(rest);
    return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
  }
  if (sub === "push") return null;
  const args = rest
    .trim()
    .split(/\s+/)
    .filter((a) => a && !a.startsWith("-"));
  return sub === "checkout" || sub === "switch" ? (args.at(-1) ?? null) : args.join(" ") || null;
}

export function classifyCommand(command: string): {
  kind: "test" | "install" | "git" | "command";
  target: string;
} {
  const trimmed = command.trim();
  const short = trimmed.slice(0, COMMAND_MAX);
  if (TEST_COMMAND.test(trimmed)) return { kind: "test", target: short };
  if (INSTALL_COMMAND.test(trimmed)) return { kind: "install", target: short };
  const git = GIT_COMMAND.exec(trimmed);
  if (git?.[1]) {
    const arg = gitArgument(git[1], git[2] ?? "");
    return { kind: "git", target: (arg ? `${git[1]}${SEP}${arg}` : git[1]).slice(0, COMMAND_MAX) };
  }
  return { kind: "command", target: short };
}

const count = (output: string, pattern: RegExp): number | null => {
  const m = pattern.exec(output);
  return m?.[1] === undefined ? null : Number(m[1]);
};

export function testCounts(output: string): Counts | null {
  const bunPassed = count(output, /(\d+) pass\b/);
  if (bunPassed !== null) return { passed: bunPassed, failed: count(output, /(\d+) fail\b/) ?? 0 };
  const passed = count(output, /(\d+) passed\b/);
  const failed = count(output, /(\d+) failed\b/);
  return passed === null && failed === null ? null : { passed: passed ?? 0, failed: failed ?? 0 };
}

const DENIAL = /\bdenied\b|\bblocked by\b|doesn't want to proceed|\brefusé/i;
export const denialOf = (output: string | null): boolean => output !== null && DENIAL.test(output);

const FAILED_EXIT = /Exit code [1-9]/;

export function actionOf(call: ToolCall): RunAction {
  const { kind, target } = classifyTool(call.tool, call.input);
  const tests = kind === "test" ? testCounts(call.output ?? "") : null;
  const failed = call.isError || (tests?.failed ?? 0) > 0 || FAILED_EXIT.test(call.output ?? "");
  const base: Omit<RunAction, "label"> = {
    tool: call.tool.slice(0, 100),
    kind,
    target: target?.slice(0, 500) ?? null,
    outcome: call.denied ? "denied" : failed ? "error" : "ok",
    detail: call.output?.slice(0, MOMENT_DETAIL_MAX) ?? null,
    patch: call.patch,
    tests,
  };
  return { ...base, label: actionLabel(base) };
}

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;
const fileName = (target: string | null): string => target?.split(/[\\/]/).at(-1) ?? "";
const testsText = (t: Counts | null): string =>
  t
    ? `les tests (${plural(t.passed, "réussi", "réussis")}, ${plural(t.failed, "échec", "échecs")})`
    : "les tests";

function gitPhrase(target: string | null): string {
  const [sub = "", ...rest] = (target ?? "").split(SEP);
  const arg = rest.join(SEP);
  if (sub === "commit") return arg ? `commité « ${arg} »` : "commité";
  if (sub === "push") return "poussé";
  if (sub === "checkout" || sub === "switch") return arg ? `changé de branche (${arg})` : "changé de branche";
  return `lancé \`git ${[sub, arg].filter(Boolean).join(" ")}\``;
}

function progressPhrase(target: string | null): string {
  const parts = (target ?? "").split(",");
  const plan = parts.find((p) => p.startsWith("plan:"));
  return [
    ...(plan ? [`déclaré son plan (${plural(Number(plan.slice(5)), "étape", "étapes")})`] : []),
    ...(parts.includes("report") ? ["remis son compte rendu"] : []),
  ].join(" et ");
}

function phrase(a: Omit<RunAction, "label">): string {
  const named = (prefix: string, name: string | null) => (name ? `${prefix} ${name}` : prefix);
  switch (a.kind) {
    case "read":
      return `lu \`${fileName(a.target)}\``;
    case "search":
      return `cherché « ${a.target ?? ""} »`;
    case "edit":
      return `modifié \`${fileName(a.target)}\`${a.patch ? ` (+${a.patch.added} −${a.patch.removed})` : ""}`;
    case "create":
      return `créé \`${fileName(a.target)}\``;
    case "test":
      return `lancé ${testsText(a.tests)}`;
    case "install":
      return "installé les dépendances";
    case "git":
      return gitPhrase(a.target);
    case "command":
      return `lancé \`${a.target ?? ""}\``;
    case "question":
      return "posé une question";
    case "progress":
      return progressPhrase(a.target) || "mis à jour sa progression";
    case "todo":
      return "mis à jour sa liste de tâches";
    case "subagent":
      return named("lancé un sous-agent", a.target);
    case "mcp":
      return named("appelé", a.target);
    case "other":
      return named("utilisé un outil", a.tool || null);
  }
}

export const actionLabel = (a: Omit<RunAction, "label">): string => `A ${phrase(a)}`.slice(0, 200);

const distinct = (actions: readonly RunAction[]): number =>
  new Set(actions.map((a, i) => a.target ?? `#${i}`)).size;

const GROUPS: readonly { kind: ActionKind; many(actions: readonly RunAction[]): string; always?: boolean }[] =
  [
    { kind: "read", always: true, many: (g) => `lu ${plural(distinct(g), "fichier", "fichiers")}` },
    { kind: "search", many: (g) => `fait ${g.length} recherches` },
    { kind: "edit", always: true, many: (g) => `modifié ${plural(distinct(g), "fichier", "fichiers")}` },
    { kind: "create", always: true, many: (g) => `créé ${plural(distinct(g), "fichier", "fichiers")}` },
    {
      kind: "test",
      always: true,
      many: (g) => `lancé ${testsText([...g].reverse().find((a) => a.tests)?.tests ?? null)}`,
    },
    { kind: "install", always: true, many: () => "installé les dépendances" },
    { kind: "git", many: (g) => `lancé ${g.length} commandes git` },
    { kind: "command", many: (g) => `lancé ${g.length} commandes` },
    { kind: "question", many: (g) => `posé ${g.length} questions` },
    { kind: "progress", many: () => "mis à jour sa progression" },
    { kind: "todo", always: true, many: () => "mis à jour sa liste de tâches" },
    { kind: "subagent", many: (g) => `lancé ${g.length} sous-agents` },
    { kind: "mcp", many: (g) => `appelé ${g.length} outils` },
    { kind: "other", many: (g) => `utilisé ${g.length} outils` },
  ];

export function summarizeActions(actions: readonly RunAction[]): string {
  const parts = GROUPS.flatMap((group) => {
    const members = actions.filter((a) => a.kind === group.kind);
    if (members.length === 0) return [];
    const [only] = members;
    return [members.length === 1 && only && !group.always ? phrase(only) : group.many(members)];
  });
  if (parts.length === 0) return "";
  const last = parts.pop();
  return `A ${parts.length > 0 ? `${parts.join(", ")} et ${last}` : last}`.slice(0, 300);
}

export const actionsFailed = (actions: readonly RunAction[]): boolean =>
  actions.some((a) => a.outcome !== "ok");
