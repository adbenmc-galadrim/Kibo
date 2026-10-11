import type {
  CiRun,
  ComponentFormat,
  McpCallResult,
  MemberInfo,
  PresencePeer,
  ProjectAccess,
  ProjectAsset,
  ProjectCommand,
  ProjectSnapshot,
  RunPeek,
  Selection,
  StorybookOrigin,
  Surface,
  TicketRun,
} from "@kibo/schema";
import type { MockFetch } from "./mock-calls";
import type { MockFrame } from "./mock-design";
import type { MockEmbedOptions } from "./mock-embed";
import type { MockNote } from "./mock-notes";
import type { ServerDefinition } from "./server";
import type { FileTarget, KiboSdk, NewTicketDefaults, ProjectBackend } from "./types";

export type MockSdk = {
  sdk: KiboSdk;
  backend: ProjectBackend;
  violations: string[];
  used: string[];
  opened: string[];
  newTicketRequests: NewTicketDefaults[];
  openedFiles: FileTarget[];
  openedViews: string[];
  openedRuns: string[];
  deliveries: string[];
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
};
export type MockSdkOptions = {
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
  deliveryRefused?: boolean;
  peeks?: Record<string, RunPeek>;
};
