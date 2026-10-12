import { AgentName, isReservedAgentName, suggestAgentName } from "@kibo/schema";
import { contentHash } from "./guarded-write";

const SLUG_MAX = 50;

const usable = (name: string): boolean => AgentName.safeParse(name).success && !isReservedAgentName(name);

const slugOf = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");

export function migratedName(profileName: string, profileId: string): string {
  if (usable(profileName)) return profileName;
  const suggested = suggestAgentName(profileName);
  if (suggested !== "" && usable(suggested)) return suggested;
  const slug = slugOf(profileName);
  return `migrated-${slug === "" ? contentHash(profileId).slice(0, 8) : slug}`;
}
