import type {
  ActionResult,
  Actor,
  AgentMcpRequest,
  AgentSummary,
  Batch,
  Guideline,
  KeyForecast,
  ProjectAgentTool,
  ProjectCommand,
  ProjectSnapshot,
  RunView,
} from "@kibo/schema";
import type { Orchestrator } from "../runs/orchestrator-types";

export type ProjectAgentDataPort = {
  project(projectId: string): ProjectSnapshot;
  projectName(projectId: string): string;
  projectFolder(projectId: string): string | null;
  assertWritable(projectId: string): void;
  viewer(projectId: string): string;
  agents(projectId: string): AgentSummary[];
  guidelines(projectId: string): Guideline[];
  notes(projectId: string): Promise<{ path: string; title: string; hash: string }[]>;
  readNote(projectId: string, path: string): Promise<string | null>;
  writeNote(projectId: string, path: string, content: string, mode: "create" | "update"): Promise<void>;
  runCommand(projectId: string, command: ProjectCommand): unknown;
  forecast(projectId: string): KeyForecast;
};

export type ProjectAgentAgentsPort = Pick<
  Orchestrator,
  "startProjectRun" | "answer" | "cancel" | "state" | "log"
>;

export type ProjectAgentOps = {
  tool(run: RunView, tool: ProjectAgentTool, input: unknown): Promise<string>;
  apply(batch: Batch, chosen: ReadonlySet<number>, by: Actor): Promise<ActionResult[]>;
};

export type AgentMcpSink = {
  verify(runId: string, token: string): boolean;
  run(runId: string): RunView | null;
  call(run: RunView, tool: AgentMcpRequest["tool"], input: unknown): Promise<string>;
};
