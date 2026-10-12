import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { type Actor, KiboError, type SaveResult, type SkillId, type VersionOrigin } from "@kibo/schema";
import { isTextFile, resolveSkillFile, SKILL_FILE } from "./assets";
import type { DiscoveredSkill } from "./discover";
import type { DiskFile, SkillsServiceDeps } from "./ports";

export const USER_FILE_MODE = 0o644;

export type SkillContext = {
  deps: SkillsServiceDeps;
  now(): number;
  find(id: SkillId): DiscoveredSkill;
  all(): readonly DiscoveredSkill[];
  refresh(): Promise<void>;
};

export type SkillSave = {
  id: SkillId;
  file?: string;
  content: string;
  baseHash: string | null;
  reviewId?: string;
  by: string;
};

export function historyRef(skill: Pick<DiscoveredSkill, "source" | "projectId" | "id">): string {
  if (skill.source === "project") return `project:${skill.projectId ?? ""}:${skill.id}`;
  return `${skill.source}:${skill.id}`;
}

const isMissing = (e: unknown): boolean => e instanceof Error && "code" in e && e.code === "ENOENT";
const binary = (file: string) => new KiboError("INVALID_INPUT", `fichier binaire : ${file}`);
const notFound = (id: string, file: string) => new KiboError("NOT_FOUND", `${file} of skill ${id} not found`);

export function writable(ctx: SkillContext, id: SkillId): DiscoveredSkill {
  const skill = ctx.find(id);
  if (skill.readOnly) throw new KiboError("READ_ONLY", `skill ${id} is read only`);
  return skill;
}

export async function readSkillText(
  ctx: SkillContext,
  id: SkillId,
  file = SKILL_FILE,
): Promise<DiskFile & { file: string }> {
  const skill = ctx.find(id);
  const path = await resolveSkillFile(skill.path, file);
  try {
    const info = await stat(path);
    if (!isTextFile(file, info.size)) throw binary(file);
    const read = await ctx.deps.writer.readWithHash(path);
    if (read === null) throw notFound(id, file);
    return { ...read, file };
  } catch (e) {
    if (isMissing(e)) throw notFound(id, file);
    throw e;
  }
}

function deposit(
  ctx: SkillContext,
  skill: DiscoveredSkill,
  file: string,
  content: string,
  origin: VersionOrigin,
  by: string,
) {
  return ctx.deps.history.deposit({
    kind: "skills",
    ref: historyRef(skill),
    file,
    content,
    origin,
    by,
    note: null,
  });
}

export async function saveSkillText(
  ctx: SkillContext,
  input: SkillSave,
): Promise<SaveResult<{ hash: string; modifiedAt: number }>> {
  const skill = writable(ctx, input.id);
  const file = input.file ?? SKILL_FILE;
  if (!isTextFile(file, Buffer.byteLength(input.content))) throw binary(file);
  if (input.reviewId !== undefined && ctx.deps.reviews.store.get(input.reviewId) === null)
    throw new KiboError("NOT_FOUND", `skill review ${input.reviewId} not found`);
  const path = await resolveSkillFile(skill.path, file);
  const ref = historyRef(skill);
  await mkdir(dirname(path), { recursive: true });
  const result = await ctx.deps.writer.writeGuarded({
    path,
    content: input.content,
    baseHash: input.baseHash,
    lastSeen: null,
    mode: USER_FILE_MODE,
    onExternal: async (current) => {
      if (!ctx.deps.history.hasHash("skills", ref, file, current.hash))
        deposit(ctx, skill, file, current.content, "external", input.by);
    },
  });
  if (result.kind === "missing") throw notFound(input.id, file);
  if (result.kind === "conflict") return { ok: false, conflict: result.current };
  const version = deposit(ctx, skill, file, input.content, input.reviewId ? "integrate" : "kibo", input.by);
  if (input.reviewId !== undefined) {
    const by: Actor = { kind: "human", ref: input.by };
    ctx.deps.reviews.markIntegrated(input.reviewId, version.id, by);
  }
  await ctx.refresh();
  return { ok: true, value: { hash: result.hash, modifiedAt: result.modifiedAt } };
}

export async function removeSkillAsset(
  ctx: SkillContext,
  id: SkillId,
  file: string,
  by: string,
): Promise<void> {
  const skill = writable(ctx, id);
  if (file === SKILL_FILE)
    throw new KiboError("INVALID_INPUT", "SKILL.md cannot be removed, delete the skill");
  const path = await resolveSkillFile(skill.path, file);
  try {
    const info = await stat(path);
    if (isTextFile(file, info.size)) deposit(ctx, skill, file, await readFile(path, "utf8"), "delete", by);
  } catch (e) {
    if (isMissing(e)) throw notFound(id, file);
    throw e;
  }
  await rm(path);
  await ctx.refresh();
}

export async function depositFolder(ctx: SkillContext, skill: DiscoveredSkill, by: string): Promise<void> {
  const main = await ctx.deps.writer.readWithHash(`${skill.path}/${SKILL_FILE}`);
  if (main !== null) deposit(ctx, skill, SKILL_FILE, main.content, "delete", by);
  for (const asset of skill.files.filter((a) => a.text)) {
    const path = await resolveSkillFile(skill.path, asset.path);
    deposit(ctx, skill, asset.path, await readFile(path, "utf8"), "delete", by);
  }
}
