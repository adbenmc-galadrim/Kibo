import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseSkillFile } from "@kibo/core/agents/frontmatter";
import { skillIdOf } from "@kibo/core/agents/skill-id";
import { type Skill, SkillName, type SkillSource } from "@kibo/schema";
import { isInside } from "../code/safe-path";
import { listAssets, SKILL_FILE } from "./assets";
import type { InstalledPlugin } from "./plugins";

export { resolveSkillFile } from "./assets";

export type SkillRoots = {
  claudeHome: string;
  pluginsRoot: string;
  projectFolder(projectId: string): string | null;
};
export type DiscoveredSkill = Omit<Skill, "usage" | "reviews" | "shadowedBy">;

type Origin = {
  source: SkillSource;
  projectId: string | null;
  plugin: { name: string; version: string } | null;
};

const isMissing = (e: unknown): boolean => e instanceof Error && "code" in e && e.code === "ENOENT";
const UNREADABLE = "fichier illisible";
const unreadable = (what: string) => (e: unknown) =>
  console.error(`[kibo-daemon] skills: ${what} unreadable`, e);
const hashOf = (text: string): string => createHash("sha256").update(text).digest("hex");

async function folderNames(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => e.name)
      .filter((name) => SkillName.safeParse(name).success)
      .sort();
  } catch (e) {
    if (!isMissing(e)) unreadable(`folder ${root}`)(e);
    return [];
  }
}

async function insideRoot(root: string, dir: string): Promise<boolean> {
  try {
    return isInside(await realpath(root), await realpath(dir));
  } catch (e) {
    if (!isMissing(e)) unreadable(`folder ${dir}`)(e);
    return false;
  }
}

async function readSkillFile(
  dir: string,
): Promise<{ content: string; modifiedAt: number } | typeof UNREADABLE | null> {
  const path = join(dir, SKILL_FILE);
  try {
    const [content, info] = await Promise.all([readFile(path, "utf8"), stat(path)]);
    return { content, modifiedAt: info.mtimeMs };
  } catch (e) {
    if (isMissing(e)) return null;
    unreadable(path)(e);
    return UNREADABLE;
  }
}

const assetsOf = (dir: string) =>
  listAssets(dir).catch((e: unknown) => {
    unreadable(`assets of ${dir}`)(e);
    return [];
  });

async function skillAt(root: string, folder: string, origin: Origin): Promise<DiscoveredSkill | null> {
  const dir = join(root, folder);
  if (!(await insideRoot(root, dir))) {
    console.error(`[kibo-daemon] skills: ${dir} leaves ${root}, ignored`);
    return null;
  }
  const read = await readSkillFile(dir);
  if (read === null) return null;
  const id = skillIdOf(origin.source, origin.plugin?.name ?? null, folder);
  if (read === UNREADABLE)
    return {
      id,
      ...origin,
      name: folder,
      description: "",
      path: dir,
      file: null,
      problem: UNREADABLE,
      hash: null,
      readOnly: origin.source === "plugin",
      files: [],
      modifiedAt: null,
    };
  const parsed = parseSkillFile(read.content, folder);
  const ok = "file" in parsed;
  return {
    id,
    ...origin,
    name: ok ? parsed.name : folder,
    description: ok ? (parsed.file.frontmatter.description ?? "") : "",
    path: dir,
    file: ok ? parsed.file : null,
    problem: ok ? null : parsed.problem,
    hash: hashOf(read.content),
    readOnly: origin.source === "plugin",
    files: await assetsOf(dir),
    modifiedAt: read.modifiedAt,
  };
}

async function skillsIn(root: string, origin: Origin): Promise<DiscoveredSkill[]> {
  const found: DiscoveredSkill[] = [];
  for (const folder of await folderNames(root)) {
    const skill = await skillAt(root, folder, origin);
    if (skill !== null) found.push(skill);
  }
  return found;
}

const PLUGIN_FOLDERS = ["skills", "workflow-skills"] as const;

export async function discoverSkills(
  roots: SkillRoots,
  projects: readonly { id: string; folder: string | null }[],
  plugins: readonly InstalledPlugin[],
): Promise<DiscoveredSkill[]> {
  const user = await skillsIn(join(roots.claudeHome, "skills"), {
    source: "user",
    projectId: null,
    plugin: null,
  });
  const own: DiscoveredSkill[] = [];
  for (const project of projects) {
    if (project.folder === null) continue;
    const origin: Origin = { source: "project", projectId: project.id, plugin: null };
    own.push(...(await skillsIn(join(project.folder, ".claude", "skills"), origin)));
  }
  const fromPlugins: DiscoveredSkill[] = [];
  for (const p of plugins) {
    const origin: Origin = {
      source: "plugin",
      projectId: null,
      plugin: { name: p.name, version: p.version },
    };
    for (const folder of PLUGIN_FOLDERS)
      fromPlugins.push(...(await skillsIn(join(p.installPath, folder), origin)));
  }
  return [...user, ...own, ...fromPlugins];
}
