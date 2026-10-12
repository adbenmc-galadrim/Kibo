import { join } from "node:path";
import type { AgentRef } from "@kibo/schema";
import { createAgentCatalog } from "./catalog";
import { createFileHistory } from "./file-history";
import { createNoticeBox } from "./notices";
import { createAgentFilesService } from "./service";
import { createAgentSettingsStore } from "./settings-store";
import { AGENT_TEMPLATE_FILES } from "./templates";
import { makeTestHome, PROJECT_ID } from "./test-home.test-helper";

export function makeService(options: { projectFolder?: boolean } = {}) {
  const h = makeTestHome(options);
  const settings = createAgentSettingsStore(h.db);
  let clock = 1_000;
  const history = createFileHistory({ home: h.kiboHome, db: h.db, now: () => clock++ });
  const active = new Map<AgentRef, number>();
  const catalog = createAgentCatalog({
    roots: h.roots,
    projects: () => [{ id: PROJECT_ID, folder: options.projectFolder === false ? null : h.projectFolder }],
    settings,
    history,
    activeRuns: (ref) => active.get(ref) ?? 0,
    watch: () => ({ mode: () => "watch", close: () => undefined }),
  });
  const emitted: string[] = [];
  const notices = createNoticeBox();
  const service = createAgentFilesService({
    catalog,
    roots: h.roots,
    settings,
    history,
    templates: AGENT_TEMPLATE_FILES,
    notices,
    emit: (topic) => emitted.push(topic),
  });
  return {
    h,
    service,
    settings,
    history,
    catalog,
    active,
    emitted,
    notices,
    globalDir: join(h.claudeHome, "agents"),
    projectDir: join(h.projectFolder, ".claude", "agents"),
  };
}

export const DESCRIPTION = "Relit une PR et rend un verdict";
