import type {
  Actor,
  Agent,
  AgentRef,
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
  MachineLock,
  ProjectSnapshot,
  Question,
  RunLogEntry,
  RunQuestions,
  RunView,
  Skill,
  TicketView,
} from "@kibo/schema";
import type { CliFallbacks } from "./cli-flags";
import type { TicketExecution } from "./execution-removed";
import type { HookLauncher } from "./hook-launcher";
import type { HookSink } from "./hook-route";
import type { Notice } from "./notifier";
import type { RunStore } from "./run-store";

export type TicketContext = {
  project: ProjectSnapshot;
  ticket: TicketView;
  domain: Domain | null;
  childCount: number;
};

export type AgentDataPort = {
  agents(projectId: string | null): Agent[];
  agentOf(ref: AgentRef): Agent | null;
  projectKey(projectId: string): string | null;
  skills(projectId: string | null): Skill[];
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
    run: { id: string; profileName: string; cwd?: string | null },
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

export type DemoAgent = { bin: string; env(): Record<string, string> };

export type ProjectTurn = { cwd: string; systemPrompt: string; prompt: string };
export type ProjectTurnPort = { prepare(run: RunView, runDir: string): Promise<ProjectTurn> };
export type ProjectRunInput = { projectId: string; projectName: string; text: string };

export type TurnPrefixPort = {
  briefSection(run: RunView): Promise<string | null>;
  changedSection(run: RunView): Promise<string | null>;
};

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
  cliFallbacks?: Partial<CliFallbacks>;
  onSpawned?: (run: RunView) => Promise<void>;
  onTurnEnd?: (run: RunView) => Promise<void>;
  onEndedWithoutTurn?: (run: RunView) => Promise<void>;
  turnPrefix?: TurnPrefixPort;
  locks?: () => MachineLock[];
  ticketExecution?: TicketExecution;
};

export type AssignInput = {
  projectId: string;
  ticketId: string;
  profileId: AgentRef;
  brief: string;
  fresh?: boolean;
};
export type ToolGuard = (call: {
  tool: string;
  input: Record<string, unknown> | null;
}) => GuardDecision | null;
export type TaskInput = {
  profileId: AgentRef;
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
  ticketExecution(): TicketExecution;
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
  activeRuns(ref: AgentRef): number;
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
