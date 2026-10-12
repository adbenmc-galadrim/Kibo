import type { Agent, AgentRef, SkillId } from "@kibo/schema";
import { writeAtomically } from "../agent-files/atomic-write";
import { type ClaudeEnv, pluginsRootOf } from "../agent-files/claude-home";
import type { ProjectFolderRef } from "../agent-files/discover";
import type { FileHistory } from "../agent-files/file-history";
import { readWithHash, writeGuarded } from "../agent-files/guarded-write";
import type { AgentRoots } from "../agent-files/paths";
import type { RpcExtension } from "../rpc-extensions";
import type { WatchSkills } from "./ports";
import type { SkillReviews, SkillReviewsDeps } from "./reviews";
import { type SkillRpcData, skillsRpc } from "./rpc";
import { createSkillsService, type SkillsService } from "./service";
import type { SkillUses } from "./uses-store";

export type SkillsInput = {
  roots: AgentRoots;
  env: ClaudeEnv;
  projects(): ProjectFolderRef[];
  history: Pick<FileHistory, "deposit" | "hasHash" | "read">;
  uses: Pick<SkillUses, "usage">;
  reviews: SkillReviews;
  agents(): Pick<Agent, "ref" | "settings">[];
  emit(): void;
  data: SkillRpcData;
  watch?: WatchSkills | null;
};

export type Skills = { service: SkillsService; rpc: RpcExtension; stop(): void };

export const citingAgents =
  (agents: () => Pick<Agent, "ref" | "settings">[]) =>
  (id: SkillId): AgentRef[] =>
    agents()
      .filter(({ settings }) => settings.skills.mode === "list" && settings.skills.ids.includes(id))
      .map((a) => a.ref);

export const skillTargetOf =
  (service: () => Pick<SkillsService, "byId"> | null): SkillReviewsDeps["skillPath"] =>
  (id, projectId) => {
    const skill = service()?.byId(id, projectId) ?? null;
    return skill && { path: skill.path, hash: skill.hash };
  };

export async function startSkills(input: SkillsInput): Promise<Skills> {
  const { claudeHome, projectFolder } = input.roots;
  const service = createSkillsService({
    roots: { claudeHome, pluginsRoot: pluginsRootOf(input.env, claudeHome), projectFolder },
    projects: input.projects,
    history: input.history,
    writer: { readWithHash, writeGuarded, writeAtomically },
    uses: input.uses,
    reviews: input.reviews,
    citing: citingAgents(input.agents),
    emit: input.emit,
    ...(input.watch !== undefined && { watch: input.watch }),
  });
  await service
    .refresh()
    .catch((e: unknown) => console.error("[kibo-daemon] skills discovery failed at startup", e));
  return { service, rpc: skillsRpc(service, input.reviews, input.data), stop: () => service.close() };
}
