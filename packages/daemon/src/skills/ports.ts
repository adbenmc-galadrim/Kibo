import type {
  AgentRef,
  FileVersion,
  FileVersionKind,
  SkillId,
  SkillScope,
  VersionOrigin,
} from "@kibo/schema";
import type { WatchHandle, WatchOptions, WatchTarget } from "../code/watcher";
import type { SkillRoots } from "./discover";
import type { InstalledPlugin } from "./plugins";
import type { SkillReviews } from "./reviews";
import type { SkillUses } from "./uses-store";

export type SkillLocation = SkillScope & { id: SkillId };
export type DiskFile = { content: string; hash: string; modifiedAt: number };
export type GuardedWrite =
  | { kind: "written"; hash: string; modifiedAt: number }
  | { kind: "conflict"; current: DiskFile }
  | { kind: "missing" };

export type FileWriter = {
  readWithHash(path: string): Promise<DiskFile | null>;
  writeGuarded(input: {
    path: string;
    content: string;
    baseHash: string | null;
    lastSeen: string | null;
    mode: number;
    onExternal?(current: { content: string; hash: string }): Promise<void>;
  }): Promise<GuardedWrite>;
  writeAtomically(path: string, content: string, mode: number): Promise<void>;
};

export type SkillHistoryDeposit = {
  kind: FileVersionKind;
  ref: string;
  file: string;
  content: string;
  origin: VersionOrigin;
  by: string | null;
  note: string | null;
};

export type SkillHistory = {
  deposit(input: SkillHistoryDeposit): FileVersion;
  read(id: string): { version: FileVersion; content: string | null } | null;
  hasHash(kind: FileVersionKind, ref: string, file: string, hash: string): boolean;
};

export type WatchSkills = (
  targets: WatchTarget[],
  onChange: (paths: string[] | null) => void,
  opts?: WatchOptions,
) => WatchHandle;

export type SkillsServiceDeps = {
  roots: SkillRoots;
  projects(): { id: string; folder: string | null }[];
  history: SkillHistory;
  writer: FileWriter;
  uses: Pick<SkillUses, "usage">;
  reviews: Pick<SkillReviews, "store" | "markIntegrated">;
  citing(skillId: SkillId): AgentRef[];
  emit(topic: "skills"): void;
  now?: () => number;
  watch?: WatchSkills | null;
  plugins?: (pluginsRoot: string) => Promise<InstalledPlugin[]>;
};
