import type {
  Actor,
  AgentProfile,
  AgentsState,
  AskInput,
  AssignPreview,
  Domain,
  GuardDecision,
  Guideline,
  HostInfo,
  HostLoad,
  HostSettings,
  HostView,
  ProjectSnapshot,
  Question,
  RunLogEntry,
  RunQuestions,
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
  assertWritable(projectId: string): void;
  assignTicket(projectId: string, ticketId: string, profileName: string): void;
  runStarted(projectId: string, ticketId: string): void;
  runDone(projectId: string, ticketId: string): void;
  isDemoProject(projectId: string): boolean;
  createQuestion(
    projectId: string,
    ticketId: string,
    run: { id: string; profileName: string },
    ask: AskInput,
  ): Question | null;
  answerRunQuestion(projectId: string, runId: string, text: string, by: Actor): Question | null;
  runQuestions(): RunQuestions[];
  undeliveredAnswers(projectId: string, ticketId: string): Question[];
  markAnswersDelivered(
    projectId: string,
    ticketId: string,
    questionIds: readonly string[],
    runId: string,
  ): void;
};

export const DEMO_PROFILE_ID = "demo";
export type DemoAgent = { bin: string; env(): Record<string, string> };

export type ProjectTurn = { cwd: string; systemPrompt: string; prompt: string };
export type ProjectTurnPort = { prepare(run: RunView, runDir: string): Promise<ProjectTurn> };
export type ProjectRunInput = { projectId: string; projectName: string; text: string };

export type OrchestratorOptions = {
  home: string;
  store: RunStore;
  data: AgentDataPort;
  claudeBin: string | null;
  hook: HookLauncher;
  demoAgent: DemoAgent;
  baseUrl: () => string;
  sampler: () => HostLoad;
  hostInfo: HostInfo;
  notify: (notice: Notice) => void;
  projectTurns: ProjectTurnPort;
  env?: Record<string, string | undefined>;
  userHome?: string;
  now?: () => number;
  tickMs?: number;
  newToken?: (runId: string) => { token: string; hash: string };
};

export type AssignInput = {
  projectId: string;
  ticketId: string;
  profileId: string;
  brief: string;
  fresh?: boolean;
};
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
  startProjectRun(input: ProjectRunInput): RunView;
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
