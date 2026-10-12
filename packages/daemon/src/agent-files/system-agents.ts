import { DEFAULT_PROJECT_AGENT_BODY } from "@kibo/core/agents/compose";
import { renderAgentFile } from "@kibo/core/agents/frontmatter";
import {
  type AgentFile,
  SYSTEM_AGENT_IDS,
  type SystemAgentId,
  systemAgentName,
  systemAgentRef,
} from "@kibo/schema";
import { AGENT_FILE } from "./catalog";
import type { FileHistory } from "./file-history";
import { readWithHash } from "./guarded-write";
import { type AgentRoots, agentPath } from "./paths";
import { versionedWrite } from "./versioned-write";

export const AGENT_FILE_MODE = 0o644;

export const SYSTEM_AGENT_DESCRIPTIONS: Readonly<Record<SystemAgentId, string>> = {
  assistant: "Répond aux questions sur un ticket ou un projet depuis Kibo",
  generateur: "Génère des tickets et des composants à partir d'une demande faite dans Kibo",
  demo: "Joue les tickets du projet de démonstration de Kibo",
  "project-agent": "Pilote un projet Kibo : lit son état, propose des lots et répond aux questions",
};

export const defaultSystemBody = (id: SystemAgentId): string =>
  id === "project-agent" ? DEFAULT_PROJECT_AGENT_BODY : "";

export function systemAgentFile(id: SystemAgentId, body: string, model?: string): AgentFile {
  return {
    frontmatter: {
      name: systemAgentName(id),
      description: SYSTEM_AGENT_DESCRIPTIONS[id],
      ...(model === undefined ? {} : { model }),
      extra: "",
      extraKeys: [],
    },
    body,
  };
}

export async function ensureSystemAgents(deps: {
  roots: AgentRoots;
  history: FileHistory;
  expect?(hash: string): void;
}): Promise<SystemAgentId[]> {
  const created: SystemAgentId[] = [];
  for (const id of SYSTEM_AGENT_IDS) {
    const ref = systemAgentRef(id);
    const path = agentPath(deps.roots, ref);
    if ((await readWithHash(path)) !== null) continue;
    const result = await versionedWrite({
      history: deps.history,
      kind: "agents",
      ref,
      file: AGENT_FILE,
      path,
      content: renderAgentFile(systemAgentFile(id, defaultSystemBody(id))),
      baseHash: null,
      mode: AGENT_FILE_MODE,
      origin: "kibo",
      by: null,
      expect: deps.expect,
    });
    if (result.kind === "written") created.push(id);
  }
  return created;
}
