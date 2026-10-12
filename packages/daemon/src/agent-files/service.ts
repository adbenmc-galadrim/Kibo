import { rm } from "node:fs/promises";
import { renderAgentFile } from "@kibo/core/agents/frontmatter";
import { agentSummary } from "@kibo/core/agents/summary";
import {
  type Agent,
  type AgentCreateInput,
  type AgentFile,
  AgentRef,
  type AgentSettings,
  type AgentSettingsPatch,
  type AgentSummary,
  agentRef,
  type FileVersion,
  type FileVersionKind,
  KiboError,
  type MigrationNotice,
  parseAgentRef,
  type SaveResult,
  type VersionOrigin,
} from "@kibo/schema";
import {
  assertDescription,
  assertFileMatchesRef,
  assertNewName,
  assertNotSystem,
  assertSettingsPatch,
} from "./agent-rules";
import { AGENT_FILE, type AgentCatalog } from "./catalog";
import type { FileHistory } from "./file-history";
import { readWithHash } from "./guarded-write";
import type { NoticeBox } from "./notices";
import { type AgentRoots, agentPath } from "./paths";
import type { AgentSettingsStore } from "./settings-store";
import { AGENT_FILE_MODE, ensureSystemAgents } from "./system-agents";
import type { AgentTemplates } from "./templates";
import { versionedWrite } from "./versioned-write";

export type AgentVersions = {
  list(kind: FileVersionKind, ref: string, file?: string): FileVersion[];
  read(id: string): { version: FileVersion; content: string | null };
  restore(id: string, baseHash: string | null, by: string): Promise<SaveResult<FileVersion>>;
};
export type AgentFilesService = {
  list(projectId: string | null): {
    agents: AgentSummary[];
    notices: MigrationNotice[];
    partialWatch: boolean;
  };
  read(ref: AgentRef): Agent;
  create(input: AgentCreateInput, by: string): Promise<{ agent: Agent; missingSubagents: string[] }>;
  save(ref: AgentRef, file: AgentFile, baseHash: string | null, by: string): Promise<SaveResult<Agent>>;
  delete(ref: AgentRef, by: string): Promise<void>;
  settings(ref: AgentRef, patch: AgentSettingsPatch): AgentSettings;
  rename(ref: AgentRef, name: string, by: string): Promise<Agent>;
  versions: AgentVersions;
  ensureSystemAgents(): Promise<void>;
  catalog: AgentCatalog;
};
export type AgentFilesDeps = {
  catalog: AgentCatalog;
  roots: AgentRoots;
  settings: AgentSettingsStore;
  history: FileHistory;
  templates: AgentTemplates;
  notices: NoticeBox;
  emit(topic: "agent-files"): void;
};

type WriteInput = {
  ref: AgentRef;
  content: string;
  baseHash: string | null;
  origin: VersionOrigin;
  by: string;
};

export function createAgentFilesService(deps: AgentFilesDeps): AgentFilesService {
  const { catalog, roots, settings, history } = deps;

  const read = (ref: AgentRef): Agent => {
    const agent = catalog.byRef(ref);
    if (!agent) throw new KiboError("AGENT_NOT_FOUND", `agent ${ref} not found`);
    return agent;
  };

  const write = (input: WriteInput) =>
    versionedWrite({
      history,
      kind: "agents",
      ref: input.ref,
      file: AGENT_FILE,
      path: agentPath(roots, input.ref),
      content: input.content,
      baseHash: input.baseHash,
      mode: AGENT_FILE_MODE,
      origin: input.origin,
      by: input.by,
      expect: catalog.expect,
    });

  const changed = async () => {
    await catalog.refresh();
    deps.emit("agent-files");
  };

  const createFile = async (input: WriteInput): Promise<void> => {
    const result = await write(input);
    if (result.kind !== "written") throw new KiboError("CONFLICT", `agent ${input.ref} already exists`);
  };

  const removeFile = async (agent: Agent, by: string) => {
    const current = await readWithHash(agent.path);
    if (current) {
      history.deposit({
        kind: "agents",
        ref: agent.ref,
        file: AGENT_FILE,
        content: current.content,
        origin: "delete",
        by,
        note: null,
      });
    }
    await rm(agent.path, { force: true });
  };

  const conductorSubagents = (scope: AgentRef, names: readonly string[]) => {
    const parsed = parseAgentRef(scope);
    const projectId = parsed.scope === "project" ? parsed.projectId : null;
    const refs = names.map((name) => agentRef(parsed.scope, projectId, name));
    const found = refs.filter((ref) => catalog.byRef(ref)?.file);
    return { found, missing: names.filter((_, i) => !found.includes(refs[i] ?? "")) };
  };

  return {
    list: (projectId) => ({
      agents: catalog.list(projectId).map(agentSummary),
      notices: deps.notices.take(),
      partialWatch: catalog.partialWatch(),
    }),
    read,
    async create(input, by) {
      assertNewName(input.name, input.description);
      assertDescription(input.description);
      if (input.scope === "project" && !input.projectId) {
        throw new KiboError("INVALID_INPUT", "a project agent needs its project");
      }
      const ref = agentRef(input.scope, input.projectId ?? null, input.name);
      const template = deps.templates[input.template];
      const file: AgentFile = {
        frontmatter: {
          name: input.name,
          description: input.description,
          ...(input.model === undefined ? {} : { model: input.model }),
          extra: "",
          extraKeys: [],
        },
        body: template.body,
      };
      await createFile({ ref, content: renderAgentFile(file), baseHash: null, origin: "kibo", by });
      await catalog.refresh();
      const { found, missing } = conductorSubagents(ref, template.subagents);
      if (found.length > 0) settings.set(ref, { subagents: found });
      deps.emit("agent-files");
      return { agent: read(ref), missingSubagents: missing };
    },
    async save(ref, file, baseHash, by) {
      assertFileMatchesRef(ref, file);
      const result = await write({ ref, content: renderAgentFile(file), baseHash, origin: "kibo", by });
      if (result.kind === "missing") throw new KiboError("NOT_FOUND", `agent ${ref} no longer exists`);
      if (result.kind === "conflict") return { ok: false, conflict: result.current };
      await changed();
      return { ok: true, value: read(ref) };
    },
    async delete(ref, by) {
      assertNotSystem(ref, "deleted");
      const agent = read(ref);
      if (agent.activeRuns > 0)
        throw new KiboError("AGENT_IN_USE", `agent ${ref} has ${agent.activeRuns} active runs`);
      await removeFile(agent, by);
      settings.remove(ref);
      await changed();
    },
    settings(ref, patch) {
      read(ref);
      assertSettingsPatch(ref, patch);
      const next = settings.set(ref, patch);
      deps.emit("agent-files");
      return next;
    },
    async rename(ref, name, by) {
      assertNotSystem(ref, "renamed");
      const agent = read(ref);
      if (!agent.file) throw new KiboError("INVALID_INPUT", `agent ${ref} is unreadable: ${agent.problem}`);
      assertNewName(name, agent.file.frontmatter.description);
      const target = agentRef(agent.scope, agent.projectId, name);
      const file: AgentFile = { ...agent.file, frontmatter: { ...agent.file.frontmatter, name } };
      await createFile({ ref: target, content: renderAgentFile(file), baseHash: null, origin: "kibo", by });
      await removeFile(agent, by);
      settings.move(ref, target);
      for (const citing of settings.citing(ref)) {
        const subagents = settings.get(citing).subagents.map((s) => (s === ref ? target : s));
        settings.set(citing, { subagents });
      }
      await changed();
      return read(target);
    },
    versions: {
      list: (kind, ref, file) => history.list(kind, ref, file),
      read(id) {
        const found = history.read(id);
        if (!found) throw new KiboError("NOT_FOUND", `version ${id} not found`);
        return found;
      },
      async restore(id, baseHash, by) {
        const found = history.read(id);
        if (!found) throw new KiboError("NOT_FOUND", `version ${id} not found`);
        if (found.content === null) throw new KiboError("NOT_FOUND", `version ${id} has no content`);
        const parsed = AgentRef.safeParse(found.version.ref);
        if (found.version.kind !== "agents" || !parsed.success) {
          throw new KiboError("INVALID_INPUT", `version ${id} is not an agent version`);
        }
        const ref = parsed.data;
        const result = await write({ ref, content: found.content, baseHash, origin: "restore", by });
        if (result.kind === "missing") throw new KiboError("NOT_FOUND", `agent ${ref} no longer exists`);
        if (result.kind === "conflict") return { ok: false, conflict: result.current };
        await changed();
        return { ok: true, value: result.version };
      },
    },
    async ensureSystemAgents() {
      const created = await ensureSystemAgents({ roots, history, expect: catalog.expect });
      if (created.length > 0) await changed();
      else await catalog.refresh();
    },
    catalog,
  };
}
