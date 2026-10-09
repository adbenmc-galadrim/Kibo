import { changeNames, diffFingerprints, renderDigest } from "@kibo/core/project-agent/digest";
import { fingerprint } from "@kibo/core/project-agent/fingerprint";
import { assignableProfiles, projectOverview, ticketSheet } from "@kibo/core/project-agent/overview";
import { compactJson, listQuestions, listRuns, listTickets, pageOf } from "@kibo/core/project-agent/tools";
import {
  type Batch,
  CursorInput,
  GetTicketInput,
  KiboError,
  ListQuestionsInput,
  ListRunsInput,
  ListTicketsInput,
  MEMORY_NOTE_PATH,
  type ProjectAgentTool,
  type ProjectFingerprint,
  ReadNoteInput,
  type RunView,
} from "@kibo/schema";
import type { z } from "zod";
import type { ProjectAgentAgentsPort, ProjectAgentDataPort } from "./types";

export const TOOL_REPLY_MAX = 200_000;

export type ProjectToolDeps = {
  data: ProjectAgentDataPort;
  agents: () => ProjectAgentAgentsPort;
  store: {
    fingerprint(runId: string): ProjectFingerprint | null;
    lastDecided(projectId: string, since: number): Batch | null;
  };
  propose: (run: RunView, input: unknown) => string;
};

type ToolCall = { deps: ProjectToolDeps; run: RunView; projectId: string; input: unknown };

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  return parsed.data;
}

async function overview({ deps, projectId }: ToolCall) {
  const { data } = deps;
  const { runs, queue } = deps.agents().state();
  return projectOverview({
    project: data.project(projectId),
    runs,
    queue,
    notes: await data.notes(projectId),
    profiles: data.profiles(),
    demoProject: data.isDemoProject(projectId),
    memory: (await data.readNote(projectId, MEMORY_NOTE_PATH)) ?? "",
  });
}

function ticketOf({ deps, projectId, input }: ToolCall) {
  const { key } = parse(GetTicketInput, input);
  const project = deps.data.project(projectId);
  const ticket = project.tickets.find((t) => t.key === key);
  if (!ticket) throw new KiboError("NOT_FOUND", `ticket ${key} not found in this project`);
  return ticketSheet(project, ticket, deps.agents().state().runs);
}

async function noteOf({ deps, projectId, input }: ToolCall) {
  const { path } = parse(ReadNoteInput, input);
  const content = await deps.data.readNote(projectId, path);
  if (content === null) throw new KiboError("NOT_FOUND", `note ${path} not found`);
  return { path, content };
}

async function changes({ deps, run, projectId }: ToolCall): Promise<string> {
  const before = deps.store.fingerprint(run.id);
  if (!before) throw new KiboError("NOT_FOUND", "no previous turn to compare with");
  const { data } = deps;
  const project = data.project(projectId);
  const { runs } = deps.agents().state();
  const after = fingerprint({ project, runs, notes: await data.notes(projectId) });
  const lines = diffFingerprints(before, after, changeNames(project, runs, before));
  return renderDigest(lines, deps.store.lastDecided(projectId, run.createdAt), Number.POSITIVE_INFINITY);
}

async function reply(tool: ProjectAgentTool, call: ToolCall): Promise<unknown> {
  const { deps, projectId, input } = call;
  switch (tool) {
    case "project_overview":
      return overview(call);
    case "list_tickets":
      return listTickets(deps.data.project(projectId), parse(ListTicketsInput, input));
    case "get_ticket":
      return ticketOf(call);
    case "list_questions":
      return listQuestions(deps.data.project(projectId), parse(ListQuestionsInput, input));
    case "list_runs": {
      const { state } = parse(ListRunsInput, input);
      const agents = deps.agents().state();
      return listRuns(agents.runs, agents.queue, projectId, state);
    }
    case "list_notes": {
      const { cursor } = parse(CursorInput, input);
      const notes = await deps.data.notes(projectId);
      return pageOf(
        notes.map((n) => ({ path: n.path, title: n.title })),
        cursor,
      );
    }
    case "read_note":
      return noteOf(call);
    case "list_profiles":
      return assignableProfiles(deps.data.profiles(), deps.data.isDemoProject(projectId)).map((p) => ({
        id: p.id,
        name: p.name,
        model: p.model,
      }));
    case "project_changes":
      return changes(call);
    case "propose_batch":
      return deps.propose(call.run, input);
  }
}

function bounded(text: string): string {
  if (Buffer.byteLength(text, "utf8") > TOOL_REPLY_MAX)
    throw new KiboError("INVALID_INPUT", "réponse trop longue, filtre ou pagine");
  return text;
}

export async function handleProjectTool(
  deps: ProjectToolDeps,
  run: RunView,
  tool: ProjectAgentTool,
  input: unknown,
): Promise<string> {
  const { projectId } = run;
  if (projectId === null || run.kind !== "project")
    throw new KiboError("FORBIDDEN", `run ${run.id} is not a project run`);
  const out = await reply(tool, { deps, run, projectId, input });
  return bounded(typeof out === "string" ? out : compactJson(out));
}
