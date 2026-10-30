import type { SkillId } from "./skill-id";

export { SkillId } from "./skill-id";

export type Skill = { id: SkillId; projectId: string | null; description: string };
