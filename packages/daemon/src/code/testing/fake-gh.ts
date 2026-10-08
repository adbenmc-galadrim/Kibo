#!/usr/bin/env bun
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

type FakePr = {
  number: number;
  url: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  isDraft: boolean;
  head: string;
  base?: string;
};

const statePath = process.env.FAKE_GH_STATE;
const logPath = process.env.FAKE_GH_LOG;
if (!statePath || !logPath) {
  process.stderr.write("FAKE_GH_STATE and FAKE_GH_LOG are required\n");
  process.exit(2);
}
const args = process.argv.slice(2);
const stdin = args.includes("--body-file") ? await Bun.stdin.text() : "";
appendFileSync(logPath, `${JSON.stringify({ args, stdin })}\n`);
const prs: FakePr[] = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : [];
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

if (process.env.FAKE_GH_FAIL === "1") {
  process.stderr.write("fake gh failure\n");
  process.exit(1);
}
if (args[0] === "auth" && args[1] === "token") {
  const token = process.env.FAKE_GH_TOKEN;
  if (!token) {
    process.stderr.write("no oauth token found for github.com\n");
    process.exit(1);
  }
  process.stdout.write(`${token}\n`);
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "status") {
  process.stdout.write("Logged in to github.com as adam\n");
  process.exit(0);
}
if (args[0] === "pr" && args[1] === "create") {
  const number = prs.length + 1;
  const url = `https://github.com/kibo/test/pull/${number}`;
  prs.push({
    number,
    url,
    state: "OPEN",
    isDraft: args.includes("--draft"),
    head: flag("head") ?? "",
    base: flag("base") ?? "",
  });
  writeFileSync(statePath, JSON.stringify(prs));
  process.stdout.write(`${url}\n`);
  process.exit(0);
}
if (args[0] === "pr" && args[1] === "view") {
  const pr = prs.find((p) => p.url === args[2] || p.head === args[2]);
  if (!pr) {
    process.stderr.write("no pull requests found for branch\n");
    process.exit(1);
  }
  process.stdout.write(
    JSON.stringify({
      number: pr.number,
      url: pr.url,
      state: pr.state,
      isDraft: pr.isDraft,
      baseRefName: pr.base,
      headRefName: pr.head,
    }),
  );
  process.exit(0);
}
if (args[0] === "pr" && args[1] === "list") {
  const head = flag("head");
  const view = (pr: FakePr) => ({
    number: pr.number,
    url: pr.url,
    state: pr.state,
    isDraft: pr.isDraft,
    baseRefName: pr.base,
    headRefName: pr.head,
  });
  process.stdout.write(JSON.stringify(prs.filter((p) => p.head === head).map(view)));
  process.exit(0);
}
process.stderr.write(`unsupported: ${args.join(" ")}\n`);
process.exit(1);
