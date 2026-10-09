import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { guidelineChain } from "@kibo/core/context";
import { changeNames, diffFingerprints, renderDigest } from "@kibo/core/project-agent/digest";
import { fingerprint, type NoteHash } from "@kibo/core/project-agent/fingerprint";
import { projectOverview, renderOverview } from "@kibo/core/project-agent/overview";
import { buildProjectAgentPrompt, firstTurnPrompt, nextTurnPrompt } from "@kibo/core/project-agent/prompt";
import {
  MEMORY_NOTE_PATH,
  PROJECT_AGENT_PROFILE_ID,
  type ProjectFingerprint,
  type ProjectSnapshot,
  type RunView,
} from "@kibo/schema";
import type { ProjectTurn, ProjectTurnPort } from "../agents/orchestrator-types";
import type { AgentContext } from "./context";
import { memoryText, projectOfRun } from "./sessions";

type TurnState = {
  projectId: string;
  project: ProjectSnapshot;
  runs: RunView[];
  notes: { path: string; title: string; hash: string }[];
};

async function ensureMemory(ctx: AgentContext, projectId: string): Promise<string> {
  const content = await ctx.data.readNote(projectId, MEMORY_NOTE_PATH);
  if (content === null) await ctx.data.writeNote(projectId, MEMORY_NOTE_PATH, "", "create");
  return memoryText(content);
}

function workingDir(folder: string | null, runDir: string): string {
  if (folder !== null && existsSync(folder)) return folder;
  const dir = join(runDir, "workspace");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function overviewPrompt(ctx: AgentContext, state: TurnState, memory: string, message: string): string {
  const overview = projectOverview({
    project: state.project,
    runs: state.runs,
    queue: ctx.agents().state().queue,
    notes: state.notes.map(({ path, title }) => ({ path, title })),
    profiles: ctx.data.profiles(),
    demoProject: ctx.data.isDemoProject(state.projectId),
    memory,
  });
  return firstTurnPrompt(renderOverview(overview), message);
}

function digestPrompt(
  ctx: AgentContext,
  state: TurnState,
  run: RunView,
  previous: ProjectFingerprint,
  current: ProjectFingerprint,
  message: string,
): string {
  const since = ctx.store.sessions(state.projectId).find((s) => s.runId === run.id)?.lastTurnAt ?? 0;
  const changes = diffFingerprints(previous, current, changeNames(state.project, state.runs, previous));
  return nextTurnPrompt(renderDigest(changes, ctx.store.lastDecided(state.projectId, since)), message);
}

function systemPrompt(ctx: AgentContext, projectId: string, projectName: string): string {
  const chain = guidelineChain(ctx.data.guidelines(projectId), {
    projectId,
    domainId: null,
    profileId: PROJECT_AGENT_PROFILE_ID,
  });
  return buildProjectAgentPrompt({
    projectName,
    chain,
    memoryPath: MEMORY_NOTE_PATH,
    viewer: ctx.data.viewer(projectId),
  });
}

async function prepareTurn(ctx: AgentContext, run: RunView, runDir: string): Promise<ProjectTurn> {
  const projectId = projectOfRun(run);
  const memory = await ensureMemory(ctx, projectId);
  const notes = await ctx.data.notes(projectId);
  const state: TurnState = {
    projectId,
    project: ctx.data.project(projectId),
    runs: ctx.agents().state().runs,
    notes,
  };
  const hashes: NoteHash[] = notes.map(({ path, hash }) => ({ path, hash }));
  const current = fingerprint({ project: state.project, runs: state.runs, notes: hashes });
  const previous = ctx.store.fingerprint(run.id);
  const message = run.pendingAnswer ?? "";
  const prompt =
    previous === null
      ? overviewPrompt(ctx, state, memory, message)
      : digestPrompt(ctx, state, run, previous, current, message);
  ctx.turnNotes.set(run.id, hashes);
  ctx.baselines.set(run.id, previous ?? current);
  ctx.store.saveFingerprint(run.id, current, ctx.now());
  return {
    cwd: workingDir(ctx.data.projectFolder(projectId), runDir),
    systemPrompt: systemPrompt(ctx, projectId, state.project.meta.name),
    prompt,
  };
}

export const createTurnPort = (ctx: AgentContext): ProjectTurnPort => ({
  prepare: (run, runDir) => prepareTurn(ctx, run, runDir),
});
