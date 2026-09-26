import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const fakeGhDir = (port: string) => join(tmpdir(), `kibo-e2e-gh-${port}`);

export const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: "Adam",
  GIT_AUTHOR_EMAIL: "adam@example.test",
  GIT_COMMITTER_NAME: "Adam",
  GIT_COMMITTER_EMAIL: "adam@example.test",
};

export type E2eRepo = {
  repo: string;
  remote: string;
  branch: string;
  git(...args: string[]): string;
  write(path: string, content: string): void;
  remove(): void;
};

const numberedLines = (count: number) =>
  `${Array.from({ length: count }, (_, i) => `export const line${i + 1} = ${i + 1};`).join("\n")}\n`;

export function createE2eRepo(key: string): E2eRepo {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `kibo-e2e-${key}-`)));
  const repo = join(dir, "repo");
  const remote = join(dir, "remote.git");
  mkdirSync(repo);
  const env = { ...process.env, ...GIT_IDENTITY };
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), content);
  };
  const branch = `${key.toLowerCase()}-1`;
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote], { env });
  git("init", "-q", "-b", "main");
  git("config", "commit.gpgsign", "false");
  git("remote", "add", "origin", remote);
  write("src/ticket.ts", numberedLines(30));
  write("README.md", "# test\n");
  git("add", "-A");
  git("commit", "-q", "-m", "chore: init");
  git("push", "-q", "-u", "origin", "main");
  git("checkout", "-q", "-b", branch);
  return { repo, remote, branch, git, write, remove: () => rmSync(dir, { recursive: true, force: true }) };
}
