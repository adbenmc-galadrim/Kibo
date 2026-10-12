import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseSkillFile, renderSkillFile } from "@kibo/core/agents/frontmatter";
import { parseSkillId } from "@kibo/core/agents/skill-id";
import { type AgentRef, KiboError, SkillCreateInput, type SkillId, type SkillSource } from "@kibo/schema";
import { lstatOrNull } from "../fs/resolve-inside";
import { SKILL_FILE } from "./assets";
import type { DiscoveredSkill } from "./discover";
import { depositFolder, historyRef, type SkillContext, USER_FILE_MODE, writable } from "./skill-files";

export type SkillTarget = { source: "user" | "project"; projectId?: string };

export function skillsRootOf(ctx: SkillContext, target: SkillTarget): string {
  if (target.source === "user") return join(ctx.deps.roots.claudeHome, "skills");
  if (target.projectId === undefined)
    throw new KiboError("INVALID_INPUT", "projectId is required for a project skill");
  const folder = ctx.deps.roots.projectFolder(target.projectId);
  if (folder === null)
    throw new KiboError("INVALID_INPUT", `project ${target.projectId} has no local folder`);
  return join(folder, ".claude", "skills");
}

async function freeFolder(root: string, name: string): Promise<string> {
  await mkdir(root, { recursive: true });
  const dir = join(root, name);
  if ((await lstatOrNull(dir)) !== null) throw new KiboError("CONFLICT", `skill ${name} already exists`);
  return dir;
}

export async function copyFolder(from: string, to: string): Promise<void> {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) await copyFolder(source, target);
    else if (entry.isFile()) await copyFile(source, target);
  }
}

function discovered(
  ctx: SkillContext,
  source: SkillSource,
  projectId: string | null,
  name: string,
): DiscoveredSkill {
  const found = ctx.all().find((s) => s.source === source && s.projectId === projectId && s.id === name);
  if (!found) throw new KiboError("INTERNAL", `skill ${name} was written but not discovered`);
  return found;
}

export async function createSkill(
  ctx: SkillContext,
  raw: SkillCreateInput,
  by: string,
): Promise<DiscoveredSkill> {
  const input = SkillCreateInput.parse(raw);
  const dir = await freeFolder(skillsRootOf(ctx, input), input.name);
  const content = renderSkillFile({
    frontmatter: { name: input.name, description: input.description, extra: "", extraKeys: [] },
    body: `# ${input.name}\n`,
  });
  await mkdir(dir, { recursive: true });
  await ctx.deps.writer.writeAtomically(join(dir, SKILL_FILE), content, USER_FILE_MODE);
  await ctx.refresh();
  const skill = discovered(ctx, input.source, input.projectId ?? null, input.name);
  ctx.deps.history.deposit({
    kind: "skills",
    ref: historyRef(skill),
    file: SKILL_FILE,
    content,
    origin: "kibo",
    by,
    note: null,
  });
  return skill;
}

async function renameInside(dir: string, name: string): Promise<void> {
  const path = join(dir, SKILL_FILE);
  const parsed = parseSkillFile(await readFile(path, "utf8"), name);
  if (!("file" in parsed) || parsed.file.frontmatter.name === undefined) return;
  const file = { ...parsed.file, frontmatter: { ...parsed.file.frontmatter, name } };
  await writeFile(path, renderSkillFile(file), { mode: USER_FILE_MODE });
}

export async function copySkill(
  ctx: SkillContext,
  id: SkillId,
  to: SkillTarget,
  name: string | undefined,
  by: string,
): Promise<{ skill: DiscoveredSkill; citedBy: AgentRef[] }> {
  const original = ctx.find(id);
  const newName = name ?? parseSkillId(id).name;
  const root = skillsRootOf(ctx, to);
  const dir = await freeFolder(root, newName);
  const staging = join(root, `.${newName}.${randomUUID()}.tmp`);
  try {
    await copyFolder(original.path, staging);
    await renameInside(staging, newName);
    await rename(staging, dir);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  await ctx.refresh();
  const skill = discovered(ctx, to.source, to.projectId ?? null, newName);
  const main = await ctx.deps.writer.readWithHash(join(dir, SKILL_FILE));
  if (main !== null)
    ctx.deps.history.deposit({
      kind: "skills",
      ref: historyRef(skill),
      file: SKILL_FILE,
      content: main.content,
      origin: "kibo",
      by,
      note: `copie de ${id}`,
    });
  return { skill, citedBy: ctx.deps.citing(id) };
}

export async function deleteSkill(ctx: SkillContext, id: SkillId, by: string): Promise<void> {
  const skill = writable(ctx, id);
  await depositFolder(ctx, skill, by);
  await rm(skill.path, { recursive: true, force: true });
  await ctx.refresh();
}
