import { Database } from "bun:sqlite";
import { afterEach } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { isInside } from "../code/safe-path";
import type { AgentRoots } from "./paths";

export const PROJECT_ID = "0b6f7a52-3c1e-4d2b-9a8f-5e4d3c2b1a00";
export const OTHER_PROJECT_ID = "1c7e8b63-4d2f-4e3c-8b9a-6f5e4d3c2b11";

export type TestHome = {
  root: string;
  claudeHome: string;
  kiboHome: string;
  projectFolder: string;
  roots: AgentRoots;
  db: Database;
  write(path: string, content: string): string;
};

const dirs: string[] = [];
const dbs: Database[] = [];

afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function assertTemporary(path: string): void {
  const real = homedir();
  for (const forbidden of [join(real, ".claude"), join(real, ".kibo")]) {
    if (isInside(forbidden, path)) throw new Error(`test home ${path} is inside ${forbidden}`);
  }
}

export function tempDir(prefix: string): string {
  const d = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  assertTemporary(d);
  dirs.push(d);
  return d;
}

export function makeTestHome(options: { projectFolder?: boolean } = {}): TestHome {
  const root = tempDir("kibo-agent-files-");
  const claudeHome = join(root, "claude");
  const kiboHome = join(root, "kibo");
  const projectFolder = join(root, "project");
  for (const d of [claudeHome, kiboHome, projectFolder]) mkdirSync(d, { recursive: true });
  const db = new Database(join(kiboHome, "kibo.db"), { create: true, strict: true });
  dbs.push(db);
  const withFolder = options.projectFolder ?? true;
  const roots: AgentRoots = {
    claudeHome,
    projectFolder: (id) => (id === PROJECT_ID && withFolder ? projectFolder : null),
  };
  return {
    root,
    claudeHome,
    kiboHome,
    projectFolder,
    roots,
    db,
    write(path, content) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
      return path;
    },
  };
}

export function copyFixtureHome(fixture: string): string {
  const target = join(tempDir("kibo-home-copy-"), "kibo");
  cpSync(fixture, target, { recursive: true });
  assertTemporary(target);
  return target;
}

export const agentText = (name: string, description = "Relit une PR et rend un verdict", body = "Corps") =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;
