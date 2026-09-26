import type {
  AgentProfile,
  AgentsState,
  AssignPreview,
  Domain,
  GuardDecision,
  Guideline,
  HostInfo,
  HostLoad,
  HostSettings,
  HostView,
  ProjectSnapshot,
  RunLogEntry,
  RunView,
  TicketView,
} from "@kibo/schema";
import type { HookLauncher } from "./hook-launcher";
import type { HookSink } from "./hook-route";
import type { Notice } from "./notifier";
import type { RunStore } from "./run-store";

export type TicketContext = { project: ProjectSnapshot; ticket: TicketView; domain: Domain | null };

export type AgentDataPort = {
  profiles(): AgentProfile[];
  ticketContext(projectId: string, ticketId: string): TicketContext;
  guidelines(projectId: string): Guideline[];
  assignTicket(projectId: string, ticketId: string, profileName: string): void;
  runStarted(projectId: string, ticketId: string): void;
  runDone(projectId: string, ticketId: string): void;
};

export type OrchestratorOptions = {
  home: string;
  store: RunStore;
  data: AgentDataPort;
  claudeBin: string | null;
  hook: HookLauncher;
  baseUrl: () => string;
  sampler: () => HostLoad;
  hostInfo: HostInfo;
  notify: (notice: Notice) => void;
  env?: Record<string, string | undefined>;
  userHome?: string;
  now?: () => number;
  tickMs?: number;
  newToken?: (runId: string) => { token: string; hash: string };
};

export type AssignInput = { projectId: string; ticketId: string; profileId: string; brief: string };
export type ToolGuard = (call: {
  tool: string;
  input: Record<string, unknown> | null;
}) => GuardDecision | null;
export type TaskInput = {
  profileId: string;
  projectId: string | null;
  title: string;
  cwd: string;
  prompt: string;
  extraArgs?: string[];
  env?: Record<string, string>;
  resumeSessionId?: string;
  guard?: ToolGuard;
};

export type Orchestrator = {
  assign(input: AssignInput): RunView;
  submit(task: TaskInput): RunView;
  preview(input: Omit<AssignInput, "brief">): AssignPreview;
  answer(runId: string, text: string): RunView;
  cancel(runId: string): RunView;
  move(runId: string, index: number): void;
  setPriority(runId: string, priority: boolean): void;
  setHost(patch: Partial<HostSettings>): HostView;
  state(): AgentsState;
  log(runId: string): RunLogEntry[];
  activeRuns(profileId: string): number;
  hooks: HookSink;
  onChange(listener: () => void): () => void;
  onRunState(listener: (run: RunView) => void): () => void;
  stop(): Promise<void>;
};

export type TaskSpec = {
  cwd: string;
  extraArgs: string[];
  env: Record<string, string>;
  resume: boolean;
  guard?: ToolGuard;
};
