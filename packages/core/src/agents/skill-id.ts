import type { SkillId, SkillSource } from "@kibo/schema";

export function skillIdOf(source: SkillSource, pluginName: string | null, name: string): SkillId {
  return source === "plugin" && pluginName ? `${pluginName}:${name}` : name;
}

export function parseSkillId(id: SkillId): { plugin: string | null; name: string } {
  const at = id.indexOf(":");
  return at === -1 ? { plugin: null, name: id } : { plugin: id.slice(0, at), name: id.slice(at + 1) };
}
