import type {
  AgentExecution,
  CiRun,
  ComponentFormat,
  DeliveryAgent,
  McpCallResult,
  ProjectAsset,
  ProjectCommand,
  ProjectEditRequest,
  ProjectEvent,
  ProjectSnapshot,
  RunDenials,
  RunPeek,
  Selection,
  Spotlight,
  StorybookOrigin,
  Surface,
  TicketRun,
  TrackingSettings,
} from "@kibo/schema";
import type { MockFetch } from "./mock-calls";
import type { MockFrame } from "./mock-design";
import type { MockEmbedOptions } from "./mock-embed";
import type { MockHold } from "./mock-holds";
import type { AllowAndResumeInput, FileTarget, KiboSdk, NewTicketDefaults, ProjectBackend } from "./types";

export type MockSdk = {
  sdk: KiboSdk;
  backend: ProjectBackend;
  violations: string[];
  used: string[];
  opened: string[];
  newTicketRequests: NewTicketDefaults[];
  openedFiles: FileTarget[];
  openedViews: string[];
  viewRequests: { componentId: string; question: string | null; intent?: Spotlight }[];
  openedRuns: string[];
  openedSprints: string[];
  projectEdits: ProjectEditRequest[];
  toasts: string[];
  runDeliveries: string[];
  allowed: AllowAndResumeInput[];
  embedCalls: string[];
  data: Map<string, unknown>;
  configPatches: Record<string, unknown>[];
  run(cmd: ProjectCommand): unknown;
  snapshot(): ProjectSnapshot;
  setRuns(runs: TicketRun[]): void;
  focusRequests: boolean[];
  selections: (Selection | null)[];
  setVisible(visible: boolean): void;
  setFocus(active: boolean): void;
  setSelection(selection: Selection | null): void;
  setSpotlight(spotlight: Spotlight | null): void;
  setTracking(tracking: TrackingSettings | null): void;
  setAgentExecution(execution: AgentExecution): void;
};
export type MockSdkOptions = {
  today?: string;
  tracking?: TrackingSettings | null;
  agentExecution?: AgentExecution;
  seed?: (run: (cmd: ProjectCommand) => unknown) => void;
  holds?: MockHold[];
  viewer?: string;
  config?: Record<string, unknown>;
  surface?: Surface;
  format?: ComponentFormat;
  runs?: TicketRun[];
  fetch?: MockFetch;
  mcp?: Record<string, McpCallResult>;
  ciRuns?: CiRun[];
  events?: ProjectEvent[];
  description?: string | null;
  client?: string | null;
  folder?: string | null;
  assets?: ProjectAsset[];
  frames?: MockFrame[];
  storybooks?: StorybookOrigin[];
  embed?: MockEmbedOptions;
  visible?: boolean;
  focus?: boolean;
  selection?: Selection | null;
  spotlight?: Spotlight | null;
  peeks?: Record<string, RunPeek>;
  denials?: Record<string, RunDenials>;
  deliveryAgent?: DeliveryAgent | null;
};
