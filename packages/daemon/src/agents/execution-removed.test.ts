import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { Glob } from "bun";
import { assertTicketExecution, isTicketRun, refuseTicketExecution } from "./execution-removed";

test("only a run tied to a ticket is a ticket run", () => {
  expect(isTicketRun({ kind: "ticket", ticketId: "t1" })).toBe(true);
  expect(isTicketRun({ kind: "ticket", ticketId: null })).toBe(false);
  expect(isTicketRun({ kind: "project", ticketId: null })).toBe(false);
});

test("the refusal carries the stable code and names what was refused", () => {
  const refused = (() => {
    try {
      refuseTicketExecution("deliver");
    } catch (e) {
      return e;
    }
    return null;
  })();
  expect(refused).toBeInstanceOf(KiboError);
  expect(refused).toMatchObject({ code: "AGENT_EXECUTION_REMOVED" });
  expect(refused instanceof KiboError && refused.detail.startsWith("deliver: ")).toBe(true);
});

test("only an explicit allowed mode lets ticket execution through", () => {
  expect(() => assertTicketExecution("removed", "assign")).toThrow("AGENT_EXECUTION_REMOVED");
  expect(() => assertTicketExecution("allowed", "assign")).not.toThrow();
});

const DAEMON = join(import.meta.dir, "..");
const ROOT = join(DAEMON, "..", "..", "..");
const TEST_FILE = /\.(test|int\.test|integration\.test|property\.test|test-helper|spec)\.tsx?$/;

const TICKET_EXECUTION_FILES: ReadonlySet<string> = new Set([
  "agents-rpc.ts",
  "agents/orchestrator.ts",
  "agents/orchestrator-assign.ts",
  "agents/orchestrator-types.ts",
  "agents/question-delivery.ts",
  "agents/execution-removed.ts",
  "daemon.ts",
  "daemon-agents.ts",
  "daemon-options.ts",
  "delivery/allow-resume.ts",
  "delivery/bootstrap.ts",
  "delivery/deliver.ts",
  "delivery/delivery-ops.ts",
  "project-agent/apply-actions.ts",
  "project-agent/types.ts",
  "ai/testing/harness.ts",
]);

const ALLOWED_LITERAL_FILES: Readonly<Record<string, string>> = {
  "agents/execution-removed.ts": "the only place that names the allowed mode",
  "sandbox/sandbox-service.ts": "log line of the sandbox consent, unrelated to ticket agents",
};

type Source = { path: string; text: string };

const sourcesOf = (root: string, pattern: string): Source[] =>
  [...new Glob(pattern).scanSync(root)]
    .filter((path) => !TEST_FILE.test(path) && !path.includes("node_modules/"))
    .map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));

function daemonViolations(sources: readonly Source[]): string[] {
  return sources.flatMap(({ path, text }) => [
    ...(text.includes('"allowed"') && !(path in ALLOWED_LITERAL_FILES) ? [`${path}: "allowed"`] : []),
    ...(text.includes("ticketExecution") && !TICKET_EXECUTION_FILES.has(path)
      ? [`${path}: ticketExecution`]
      : []),
  ]);
}

const outsideViolations = (sources: readonly Source[]): string[] =>
  sources
    .filter(({ text }) => text.includes("ticketExecution"))
    .map(({ path }) => `${path}: ticketExecution`);

test("no production source of the daemon can turn ticket execution on", () => {
  const sources = sourcesOf(DAEMON, "**/*.ts");
  expect(sources.map((s) => s.path)).toContain("main.ts");
  expect(daemonViolations(sources)).toEqual([]);
});

test("no source outside the daemon mentions ticket execution", () => {
  const sources = ["e2e", "scripts", "apps", "packages/cli/src"].flatMap((dir) =>
    sourcesOf(join(ROOT, dir), "**/*.{ts,tsx}").map((s) => ({ ...s, path: `${dir}/${s.path}` })),
  );
  expect(sources.length).toBeGreaterThan(0);
  expect(outsideViolations(sources)).toEqual([]);
});

test("the detection flags an indirect allowed mode, a new file and an outside mention", () => {
  const indirect = 'const m = "allowed";\nstartAgents({ ...opts, ticketExecution: m });';
  expect(daemonViolations([{ path: "main.ts", text: indirect }])).toEqual([
    'main.ts: "allowed"',
    "main.ts: ticketExecution",
  ]);
  expect(daemonViolations([{ path: "x/new.ts", text: "const o = { ...base(), ticketExecution };" }])).toEqual(
    ["x/new.ts: ticketExecution"],
  );
  expect(daemonViolations([{ path: "daemon.ts", text: 'mode("allowed")' }])).toEqual([
    'daemon.ts: "allowed"',
  ]);
  expect(outsideViolations([{ path: "e2e/serve.ts", text: "ticketExecution: pick()" }])).toEqual([
    "e2e/serve.ts: ticketExecution",
  ]);
});
