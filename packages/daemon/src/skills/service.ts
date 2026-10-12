import { statSync } from "node:fs";
import { join } from "node:path";
import {
  type AgentRef,
  KiboError,
  type SaveResult,
  type Skill,
  type SkillAsset,
  type SkillCreateInput,
  type SkillId,
} from "@kibo/schema";
import { type WatchHandle, type WatchTarget, watchPaths } from "../code/watcher";
import { listAssets, SKILL_FILE } from "./assets";
import { copySkill, createSkill, deleteSkill, type SkillTarget } from "./copy";
import { type DiscoveredSkill, discoverSkills } from "./discover";
import { readInstalledPlugins } from "./plugins";
import type { SkillsServiceDeps } from "./ports";
import {
  historyRef,
  readSkillText,
  removeSkillAsset,
  type SkillContext,
  type SkillSave,
  saveSkillText,
} from "./skill-files";

export type { FileWriter, GuardedWrite, SkillHistory, SkillHistoryDeposit, SkillsServiceDeps } from "./ports";

export type SkillsService = {
  list(projectId: string | null): { skills: Skill[]; partialWatch: boolean };
  read(
    id: SkillId,
    file?: string,
  ): Promise<{ content: string; hash: string; modifiedAt: number; file: string }>;
  save(input: SkillSave): Promise<SaveResult<{ hash: string; modifiedAt: number }>>;
  create(input: SkillCreateInput, by: string): Promise<Skill>;
  copy(
    id: SkillId,
    to: SkillTarget,
    name: string | undefined,
    by: string,
  ): Promise<{ skill: Skill; citedBy: AgentRef[] }>;
  delete(id: SkillId, by: string): Promise<void>;
  assets(id: SkillId): Promise<SkillAsset[]>;
  removeAsset(id: SkillId, file: string, by: string): Promise<void>;
  byId(id: SkillId): Skill | null;
  refresh(): Promise<void>;
  close(): void;
};

const DAY_MS = 86_400_000;
const USAGE_WINDOW_MS = 30 * DAY_MS;
export const WATCH_TARGETS_MAX = 500;
const WATCH_DEBOUNCE_MS = 300;
const SOURCE_ORDER = ["user", "project", "plugin"] as const;

const signature = (list: readonly DiscoveredSkill[]): string =>
  JSON.stringify(list.map((s) => [s.id, s.path, s.hash, s.problem, s.files]));

export function createSkillsService(deps: SkillsServiceDeps): SkillsService {
  const now = deps.now ?? Date.now;
  const watch = deps.watch === undefined ? watchPaths : deps.watch;
  const plugins = deps.plugins ?? readInstalledPlugins;
  let skills: DiscoveredSkill[] = [];
  let watcher: { key: string; handle: WatchHandle } | null = null;
  let partialWatch = false;
  let closed = false;

  const shadowOf = (skill: DiscoveredSkill): SkillId | null =>
    skill.source === "project" && skills.some((s) => s.source === "user" && s.id === skill.id)
      ? skill.id
      : null;
  const complete = (skill: DiscoveredSkill): Skill => ({
    ...skill,
    shadowedBy: shadowOf(skill),
    usage: deps.uses.usage(skill.id, now() - USAGE_WINDOW_MS),
    reviews: { open: deps.reviews.store.openCount(skill.id) },
  });
  const discoveredById = (id: SkillId): DiscoveredSkill | null => {
    for (const source of SOURCE_ORDER) {
      const found = skills.find((s) => s.id === id && s.source === source);
      if (found) return found;
    }
    return null;
  };
  const find = (id: SkillId): DiscoveredSkill => {
    const found = discoveredById(id);
    if (!found) throw new KiboError("NOT_FOUND", `skill ${id} not found`);
    return found;
  };

  function depositExternal(previous: readonly DiscoveredSkill[]): void {
    for (const skill of skills) {
      if (skill.readOnly || skill.hash === null || skill.file === null) continue;
      const before = previous.find((p) => p.path === skill.path);
      if (!before || before.hash === skill.hash) continue;
      if (deps.history.hasHash("skills", historyRef(skill), SKILL_FILE, skill.hash)) continue;
      void deps.writer
        .readWithHash(join(skill.path, SKILL_FILE))
        .then((read) => {
          if (read !== null && read.hash === skill.hash)
            deps.history.deposit({
              kind: "skills",
              ref: historyRef(skill),
              file: SKILL_FILE,
              content: read.content,
              origin: "external",
              by: null,
              note: null,
            });
        })
        .catch((e: unknown) =>
          console.error(`[kibo-daemon] skills: external version of ${skill.id} failed`, e),
        );
    }
  }

  function watchTargets(): WatchTarget[] {
    const folders = [
      join(deps.roots.claudeHome, "skills"),
      ...deps.projects().flatMap((p) => (p.folder === null ? [] : [join(p.folder, ".claude", "skills")])),
    ];
    const existing = folders.filter(
      (path) => statSync(path, { throwIfNoEntry: false })?.isDirectory() === true,
    );
    partialWatch = existing.length > WATCH_TARGETS_MAX;
    return existing.slice(0, WATCH_TARGETS_MAX).map((path) => ({ path, recursive: true }));
  }

  function arm(): void {
    if (watch === null || closed) return;
    const targets = watchTargets();
    const key = targets.map((t) => t.path).join("\n");
    if (watcher?.key === key) return;
    watcher?.handle.close();
    watcher = null;
    if (targets.length === 0) return;
    const handle = watch(
      targets,
      () => {
        refresh().catch((e: unknown) => console.error("[kibo-daemon] skills refresh failed", e));
      },
      { debounceMs: WATCH_DEBOUNCE_MS },
    );
    watcher = { key, handle };
  }

  async function refresh(): Promise<void> {
    const previous = skills;
    const installed = await plugins(deps.roots.pluginsRoot);
    skills = await discoverSkills(deps.roots, deps.projects(), installed);
    depositExternal(previous);
    arm();
    if (signature(previous) !== signature(skills)) deps.emit("skills");
  }

  const ctx: SkillContext = { deps, now, find, all: () => skills, refresh };

  return {
    list(projectId) {
      const visible = skills.filter(
        (s) => s.source !== "project" || projectId === null || s.projectId === projectId,
      );
      return { skills: visible.map(complete), partialWatch };
    },
    read: (id, file) => readSkillText(ctx, id, file),
    save: (input) => saveSkillText(ctx, input),
    create: async (input, by) => complete(await createSkill(ctx, input, by)),
    async copy(id, to, name, by) {
      const copied = await copySkill(ctx, id, to, name, by);
      return { skill: complete(copied.skill), citedBy: copied.citedBy };
    },
    delete: (id, by) => deleteSkill(ctx, id, by),
    assets: async (id) => listAssets(find(id).path),
    removeAsset: (id, file, by) => removeSkillAsset(ctx, id, file, by),
    byId(id) {
      const found = discoveredById(id);
      return found ? complete(found) : null;
    },
    refresh,
    close() {
      closed = true;
      watcher?.handle.close();
      watcher = null;
    },
  };
}
