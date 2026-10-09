import type {
  ActionResult,
  Actor,
  AgentMcpRequest,
  AgentProfile,
  Batch,
  DeliveryResult,
  Guideline,
  ProjectAgentTool,
  ProjectCommand,
  ProjectSnapshot,
  RunView,
} from "@kibo/schema";
import type { Orchestrator } from "../agents/orchestrator-types";

export type ProjectAgentDataPort = {
  project(projectId: string): ProjectSnapshot;
  projectName(projectId: string): string;
  projectFolder(projectId: string): string | null;
  assertWritable(projectId: string): void;
  viewer(projectId: string): string;
  profiles(): AgentProfile[];
  guidelines(projectId: string): Guideline[];
  isDemoProject(projectId: string): boolean;
  notes(projectId: string): Promise<{ path: string; title: string; hash: string }[]>;
  readNote(projectId: string, path: string): Promise<string | null>;
  writeNote(projectId: string, path: string, content: string, mode: "create" | "update"): Promise<void>;
  runCommand(projectId: string, command: ProjectCommand): unknown;
};

export type ProjectAgentAgentsPort = Pick<
  Orchestrator,
  "startProjectRun" | "answer" | "cancel" | "assign" | "state" | "log"
> & { deliverAnswers(projectId: string, ticketId: string): DeliveryResult };

export type ProjectAgentOps = {
  tool(run: RunView, tool: ProjectAgentTool, input: unknown): Promise<string>;
  apply(batch: Batch, chosen: ReadonlySet<number>, by: Actor): Promise<ActionResult[]>;
};

export type AgentMcpSink = {
  verify(runId: string, token: string): boolean;
  call(runId: string, req: AgentMcpRequest): Promise<string>;
};
