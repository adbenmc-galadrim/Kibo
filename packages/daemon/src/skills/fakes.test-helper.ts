import { afterEach } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { FileVersion, SkillUsage } from "@kibo/schema";
import type { SkillRoots } from "./discover";
import type { FileWriter, SkillHistory, SkillHistoryDeposit } from "./ports";

export const PROJECT_ID = "7f3c2a10-5b6d-4e8f-9a01-23456789abcd";
export const SKILL_MD = (name: string, description: string, body = `# ${name}\n`) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;

const dirs: string[] = [];
export const cleanSkillDirs = () =>
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

export function tempDir(prefix = "kibo-skills-"): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
}

export function put(path: string, content: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export type SkillsFixture = {
  base: string;
  claudeHome: string;
  pluginsRoot: string;
  project: string;
  pluginPath: string;
  roots: SkillRoots;
  projects: { id: string; folder: string | null }[];
};

export function skillsFixture(): SkillsFixture {
  const base = tempDir();
  const claudeHome = join(base, "claude");
  const pluginsRoot = join(claudeHome, "plugins");
  const project = join(base, "project");
  const pluginPath = join(pluginsRoot, "cache", "official", "superpowers", "6.4.1");
  const userSkills = join(claudeHome, "skills");
  put(join(userSkills, "brainstorming", "SKILL.md"), SKILL_MD("brainstorming", "Explore une idée"));
  put(join(userSkills, "deploy", "SKILL.md"), SKILL_MD("deploy", "Déploie l'application"));
  put(join(userSkills, "deploy", "reference.md"), "# Référence\n");
  put(join(userSkills, "deploy", "script.sh"), "echo ok\n");
  put(join(userSkills, "deploy", "image.png"), new Uint8Array([137, 80, 78, 71, 0, 1, 2]));
  put(join(userSkills, "deploy", "big.md"), "x".repeat(1_048_577));
  symlinkSync(join(base, "outside.md"), join(userSkills, "deploy", "link.md"));
  put(join(base, "outside.md"), "secret\n");
  const projectSkills = join(project, ".claude", "skills");
  put(join(projectSkills, "deploy", "SKILL.md"), SKILL_MD("deploy", "Déploie le projet"));
  put(join(projectSkills, "tests", "SKILL.md"), SKILL_MD("tests", "Lance les tests"));
  put(
    join(pluginPath, "skills", "brainstorming", "SKILL.md"),
    SKILL_MD("brainstorming", "Brainstorm plugin"),
  );
  put(join(pluginPath, "skills", "brainstorming", "notes.txt"), "notes\n");
  put(join(pluginPath, "workflow-skills", "release", "SKILL.md"), SKILL_MD("release", "Publie une version"));
  const index = {
    version: 2,
    plugins: { "superpowers@official": [{ scope: "user", installPath: pluginPath, version: "6.4.1" }] },
  };
  put(join(pluginsRoot, "installed_plugins.json"), JSON.stringify(index));
  const projects = [{ id: PROJECT_ID, folder: project }];
  const roots: SkillRoots = {
    claudeHome,
    pluginsRoot,
    projectFolder: (id) => projects.find((p) => p.id === id)?.folder ?? null,
  };
  return { base, claudeHome, pluginsRoot, project, pluginPath, roots, projects };
}

export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

export type FakeHistory = SkillHistory & { deposits: SkillHistoryDeposit[] };

export function fakeHistory(): FakeHistory {
  const deposits: SkillHistoryDeposit[] = [];
  return {
    deposits,
    deposit(input) {
      deposits.push(input);
      const version: FileVersion = {
        id: randomUUID(),
        kind: input.kind,
        ref: input.ref,
        file: input.file,
        hash: sha256(input.content),
        size: input.content.length,
        at: deposits.length,
        origin: input.origin,
        by: input.by,
        note: input.note,
        missing: false,
      };
      return version;
    },
    hasHash: (kind, ref, file, hash) =>
      deposits.some((d) => d.kind === kind && d.ref === ref && d.file === file && sha256(d.content) === hash),
  };
}

export function memoryWriter(): FileWriter & { writes: string[] } {
  const writes: string[] = [];
  const read = async (path: string) => {
    const file = Bun.file(path);
    if (!(await file.exists())) return null;
    const content = await file.text();
    return { content, hash: sha256(content), modifiedAt: file.lastModified };
  };
  const writeAtomically = async (path: string, content: string, _mode: number) => {
    writes.push(path);
    put(path, content);
  };
  return {
    writes,
    readWithHash: read,
    writeAtomically,
    async writeGuarded(input) {
      const current = await read(input.path);
      if (input.baseHash === null && current !== null) return { kind: "conflict", current };
      if (input.baseHash !== null && current === null) return { kind: "missing" };
      if (current !== null && current.hash !== input.baseHash) return { kind: "conflict", current };
      if (current !== null && current.hash !== input.lastSeen) await input.onExternal?.(current);
      await writeAtomically(input.path, input.content, input.mode);
      return { kind: "written", hash: sha256(input.content), modifiedAt: Date.now() };
    },
  };
}

export const NO_USAGE: SkillUsage = { last: null, runs30d: 0 };
