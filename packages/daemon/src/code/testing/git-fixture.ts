import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Env } from "../run";

export type GitFixture = {
  dir: string;
  repo: string;
  remote: string;
  env: Env;
  git(...args: string[]): string;
  write(path: string, content: string): void;
  commit(message: string, files: Record<string, string>): string;
  cleanup(): void;
};

const IDENTITY = { name: "Adam", email: "adam@example.test" };

export function gitSync(cwd: string, args: string[], env: Env): string {
  const r = Bun.spawnSync(["git", ...args], { cwd, env: { ...process.env, ...env } });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr.toString()}`);
  return r.stdout.toString();
}

function isolatedEnv(home: string): Env {
  return {
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: join(home, ".gitconfig"),
    GIT_AUTHOR_NAME: IDENTITY.name,
    GIT_AUTHOR_EMAIL: IDENTITY.email,
    GIT_COMMITTER_NAME: IDENTITY.name,
    GIT_COMMITTER_EMAIL: IDENTITY.email,
  };
}

export function createGitFixture(opts: { remote?: boolean } = {}): GitFixture {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "kibo-git-")));
  const home = join(dir, "home");
  mkdirSync(home);
  const env = isolatedEnv(home);
  const repo = join(dir, "repo");
  mkdirSync(repo);
  const git = (...args: string[]) => gitSync(repo, args, env);
  git("init", "-q", "-b", "main");
  git("config", "user.name", IDENTITY.name);
  git("config", "user.email", IDENTITY.email);
  git("config", "commit.gpgsign", "false");
  git("config", "tag.gpgsign", "false");
  const remote = join(dir, "remote.git");
  if (opts.remote !== false) {
    gitSync(dir, ["init", "-q", "--bare", "-b", "main", remote], env);
    git("remote", "add", "origin", remote);
  }
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), content);
  };
  return {
    dir,
    repo,
    remote,
    env,
    git,
    write,
    commit(message, files) {
      for (const [path, content] of Object.entries(files)) write(path, content);
      git("add", "-A");
      git("commit", "-q", "-m", message);
      return git("rev-parse", "HEAD").trim();
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export function installFakeGh(dir: string): Env {
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  const path = join(bin, "gh");
  copyFileSync(join(import.meta.dir, "fake-gh.ts"), path);
  chmodSync(path, 0o755);
  return { KIBO_GH: path, FAKE_GH_STATE: join(dir, "gh-state.json"), FAKE_GH_LOG: join(dir, "gh-log.jsonl") };
}

function readJsonLines(path: string): unknown[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isGhCall(value: unknown): value is { args: string[]; stdin: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "args" in value &&
    isStringArray(value.args) &&
    "stdin" in value &&
    typeof value.stdin === "string"
  );
}

export function readFakeGhLog(env: Env): { args: string[]; stdin: string }[] {
  const log = env.FAKE_GH_LOG;
  if (!log || !existsSync(log)) return [];
  return readJsonLines(log).filter(isGhCall);
}

export function installFakeBin(dir: string, name: string): { path: string; log: string } {
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  const path = join(bin, name);
  const log = join(dir, `${name}.log`);
  writeFileSync(
    path,
    '#!/usr/bin/env bun\nimport { appendFileSync } from "node:fs";\nappendFileSync(process.env.FAKE_BIN_LOG ?? "/dev/null", JSON.stringify(process.argv.slice(2)) + "\\n");\n',
  );
  chmodSync(path, 0o755);
  appendFileSync(log, "");
  return { path, log };
}

export function readFakeBinLog(log: string): string[][] {
  return readJsonLines(log).filter(isStringArray);
}
