#!/usr/bin/env bun
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

type FakeThread = {
  threadId: string;
  title: string;
  status: string;
  link: string;
  project: string;
  updatedAt?: string;
};
type FakeState = {
  mode: "ok" | "missing" | "server-down";
  threads: FakeThread[];
  nextId: string;
  startOutput?: string;
  startDropsThread?: boolean;
};

const statePath = process.env.FAKE_T3_STATE;
const logPath = process.env.FAKE_T3_LOG;
if (!statePath || !logPath) {
  process.stderr.write("FAKE_T3_STATE and FAKE_T3_LOG are required\n");
  process.exit(2);
}
const args = process.argv.slice(2);
appendFileSync(logPath, `${JSON.stringify(args)}\n`);
const state: FakeState = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { mode: "ok", threads: [], nextId: "thr_1" };
const flag = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};
const positional = (): string[] => {
  const rest = args.slice(2);
  return rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--title"));
};

if (state.mode === "missing") {
  process.stderr.write("t3: command not found\n");
  process.exit(127);
}
if (state.mode === "server-down") {
  process.stderr.write("T3 Code server is not running\n");
  process.exit(1);
}
if (args[0] === "thread" && args[1] === "start") {
  const [project = "", message = ""] = positional();
  const thread: FakeThread = {
    threadId: state.nextId,
    title: flag("title") ?? message,
    status: "running",
    link: `t3-thread://v2/fake/${state.nextId}`,
    project,
  };
  if (!state.startDropsThread) {
    state.threads.push(thread);
    state.nextId = `thr_${state.threads.length + 1}`;
    writeFileSync(statePath, JSON.stringify(state));
  }
  const { threadId, link, title } = thread;
  process.stdout.write(`${state.startOutput ?? JSON.stringify({ threadId, link, title })}\n`);
  process.exit(0);
}
if (args[0] === "thread" && args[1] === "list") {
  const project = flag("project");
  if (project === undefined) {
    process.stderr.write("No T3 Code project matches '.'. Pass a project id or a path inside a project.\n");
    process.exit(1);
  }
  const listed = state.threads
    .filter((t) => t.project === project)
    .map((t) => ({ ...t, link: t.link && `<${t.link}>` }));
  process.stdout.write(`${JSON.stringify(listed)}\n`);
  process.exit(0);
}
if (args[0] === "theme" && args[1] === "show") {
  process.stdout.write("default\n");
  process.exit(0);
}
process.stderr.write(`fake t3: unsupported ${args.join(" ")}\n`);
process.exit(3);
