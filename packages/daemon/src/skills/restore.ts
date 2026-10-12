import { type FileVersion, KiboError, type SaveResult, SkillId } from "@kibo/schema";
import type { SkillLocation } from "./ports";
import { type SkillContext, writable, writeSkillText } from "./skill-files";

export function locationOfRef(ref: string): SkillLocation {
  const [scope = "", ...rest] = ref.split(":");
  const location: SkillLocation | null =
    scope === "user"
      ? { id: rest.join(":"), scope: "user" }
      : scope === "project" && rest.length > 1
        ? { id: rest.slice(1).join(":"), scope: "project", projectId: rest[0] }
        : null;
  if (location === null || !SkillId.safeParse(location.id).success)
    throw new KiboError("INVALID_INPUT", `version ref ${ref} is not a writable skill`);
  return location;
}

export async function restoreSkillVersion(
  ctx: SkillContext,
  versionId: string,
  baseHash: string | null,
  by: string,
): Promise<SaveResult<FileVersion>> {
  const found = ctx.deps.history.read(versionId);
  if (!found) throw new KiboError("NOT_FOUND", `version ${versionId} not found`);
  if (found.version.kind !== "skills")
    throw new KiboError("INVALID_INPUT", `version ${versionId} is not a skill version`);
  if (found.content === null) throw new KiboError("NOT_FOUND", `version ${versionId} has no content`);
  const skill = writable(ctx, locationOfRef(found.version.ref));
  const written = await writeSkillText(ctx, {
    skill,
    file: found.version.file,
    content: found.content,
    baseHash,
    origin: "restore",
    by,
  });
  if (!written.ok) return written;
  await ctx.refresh();
  return { ok: true, value: written.value.version };
}
