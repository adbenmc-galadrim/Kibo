import type {
  AgentExecution,
  CiRun,
  ComponentFormat,
  DeliveryAgent,
  McpCallResult,
  MemberInfo,
  PresencePeer,
  ProjectAccess,
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
import type { MockNote } from "./mock-notes";
import type { ServerDefinition } from "./server";
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
  viewRequests: { componentId: string; question: string | null }[];
  openedRuns: string[];
  openedSprints: string[];
  projectEdits: ProjectEditRequest[];
  toasts: string[];
  deliveries: string[];
  runDeliveries: string[];
  allowed: AllowAndResumeInput[];
  embedCalls: string[];
  data: Map<string, unknown>;
  configPatches: Record<string, unknown>[];
  notes: Map<string, MockNote>;
  run(cmd: ProjectCommand): unknown;
  snapshot(): ProjectSnapshot;
  setRuns(runs: TicketRun[]): void;
  touchNote(path: string, markdown: string): void;
  setAccess(access: ProjectAccess): void;
  setPresence(peers: PresencePeer[]): void;
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
  viewer?: string;
  config?: Record<string, unknown>;
  surface?: Surface;
  format?: ComponentFormat;
  runs?: TicketRun[];
  fetch?: MockFetch;
  server?: ServerDefinition;
  notes?: Record<string, string>;
  noteAges?: Record<string, number>;
  mcp?: Record<string, McpCallResult>;
  ciRuns?: CiRun[];
  events?: ProjectEvent[];
  description?: string | null;
  client?: string | null;
  folder?: string | null;
  presence?: PresencePeer[];
  shared?: boolean;
  members?: MemberInfo[];
  assets?: ProjectAsset[];
  frames?: MockFrame[];
  storybooks?: StorybookOrigin[];
  embed?: MockEmbedOptions;
  visible?: boolean;
  focus?: boolean;
  selection?: Selection | null;
  spotlight?: Spotlight | null;
  deliveryRefused?: boolean;
  peeks?: Record<string, RunPeek>;
  denials?: Record<string, RunDenials>;
  deliveryAgent?: DeliveryAgent | null;
};
